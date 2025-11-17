using System;
using System.Threading.Tasks;
using Azure.Messaging.ServiceBus;
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using MongoDB.Driver;

class Program
{
    private const string ServiceBusConnectionString =
        "Endpoint=sb://localhost/;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=VALUE;UseDevelopmentEmulator=true;";

    private const string MongoConnectionString = "mongodb://testuser:testpass@localhost:27017";
    private const string MongoDbName = "MessageTrackingDb";
    private const string MongoCollectionName = "Messages";

    private static IMongoCollection<BsonDocument> _collection;

    static async Task Main(string[] args)
    {
        if (args.Length == 0)
        {
            Console.WriteLine("Usage:");
            Console.WriteLine("  dotnet run send <queueName> <jsonBody> <sentBy>");
            Console.WriteLine("  dotnet run receive <queueName> <receivedBy>");
            return;
        }

        var client = new MongoClient(MongoConnectionString);
        var db = client.GetDatabase(MongoDbName);
        _collection = db.GetCollection<BsonDocument>(MongoCollectionName);

        var command = args[0].ToLower();

        if (command == "send")
        {
            if (args.Length < 4)
            {
                Console.WriteLine("Usage: dotnet run send <queueName> <jsonBody> <sentBy>");
                return;
            }

            string queue = args[1];
            string body = args[2];
            string sentBy = args[3];

            await SendMessageAsync(queue, body, sentBy);
        }
        else if (command == "receive")
        {
            if (args.Length < 3)
            {
                Console.WriteLine("Usage: dotnet run receive <queueName> <receivedBy>");
                return;
            }

            string queue = args[1];
            string receivedBy = args[2];

            await ReceiveMessagesAsync(queue, receivedBy);
        }
        else
        {
            Console.WriteLine("Unknown command.");
        }
    }

    // --------------------------------------------------------
    // SEND MESSAGE
    // --------------------------------------------------------
    static async Task SendMessageAsync(string queue, string body, string sentBy)
    {
        var client = new ServiceBusClient(ServiceBusConnectionString);
        var sender = client.CreateSender(queue);

        var message = new ServiceBusMessage(body)
        {
            MessageId = Guid.NewGuid().ToString(),
            Subject = "Event",
        };

        message.ApplicationProperties["sentBy"] = sentBy;

        var repo = new MessageRepository(MongoConnectionString, MongoDbName, MongoCollectionName);

        // Save to MongoDB
        var tracked = new TrackedMessage
        {
            MessageId = message.MessageId,
            Body = body,
            SentBy = sentBy,
            SentAt = DateTime.UtcNow,
            Status = "sent"
        };

        await repo.InsertAsync(tracked);


        await sender.SendMessageAsync(message);

        Console.WriteLine($"Sent message {message.MessageId} by {sentBy}");
    }

    // --------------------------------------------------------
    // RECEIVE MESSAGE
    // --------------------------------------------------------
    static async Task ReceiveMessagesAsync(string queue, string receivedBy)
    {
        var client = new ServiceBusClient(ServiceBusConnectionString);

        var processor = client.CreateProcessor(queue, new ServiceBusProcessorOptions
        {
            AutoCompleteMessages = false
        });

        processor.ProcessMessageAsync += async args =>
        {
            var msg = args.Message;

            Console.WriteLine($"Received: {msg.Body}");
            
            var repo = new MessageRepository(MongoConnectionString, MongoDbName, MongoCollectionName);
            await repo.UpdateReceivedAsync(msg.MessageId, receivedBy);


            await args.CompleteMessageAsync(msg);

            Console.WriteLine($"Updated message {msg.MessageId} as received by {receivedBy}");
        };

        processor.ProcessErrorAsync += args =>
        {
            Console.WriteLine($"Error: {args.Exception}");
            return Task.CompletedTask;
        };

        await processor.StartProcessingAsync();

        Console.WriteLine("Receiving... press any key to stop.");
        Console.ReadKey();

        await processor.StopProcessingAsync();
    }
}

public class TrackedMessage
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    [BsonElement("_id")]
    public string Id { get; set; } = ObjectId.GenerateNewId().ToString();

    [BsonElement("messageId")]
    public string MessageId { get; set; } = default!;

    [BsonElement("body")]
    public string Body { get; set; } = default!;

    [BsonElement("sentBy")]
    public string SentBy { get; set; } = default!;

    [BsonElement("sentAt")]
    public DateTime SentAt { get; set; }

    [BsonElement("receivedBy")]
    [BsonIgnoreIfNull]
    public string? ReceivedBy { get; set; }

    [BsonElement("receivedAt")]
    [BsonIgnoreIfNull]
    public DateTime? ReceivedAt { get; set; }

    [BsonElement("status")]
    public string Status { get; set; } = "sent";
}

public class MessageRepository
{
    private readonly IMongoCollection<TrackedMessage> _collection;

    public MessageRepository(string connectionString, string dbName, string collectionName)
    {
        var client = new MongoClient(connectionString);
        var db = client.GetDatabase(dbName);

        _collection = db.GetCollection<TrackedMessage>(collectionName);
    }

    public async Task InsertAsync(TrackedMessage msg)
    {
        await _collection.InsertOneAsync(msg);
    }

    public async Task UpdateReceivedAsync(string messageId, string receivedBy)
    {
        var filter = Builders<TrackedMessage>.Filter.Eq(x => x.MessageId, messageId);

        var update = Builders<TrackedMessage>.Update
            .Set(x => x.ReceivedBy, receivedBy)
            .Set(x => x.ReceivedAt, DateTime.UtcNow)
            .Set(x => x.Status, "received");

        await _collection.UpdateOneAsync(filter, update);
    }
}


