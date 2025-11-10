import { SendMessageDto } from './entities';

describe('entities', () => {
  it('should have SendMessageDto interface', () => {
    const dto: SendMessageDto = {
      namespace: 'test',
      topic: 'test-topic',
      message: {
        body: 'test body',
        applicationProperties: {
          sentBy: 'test-user',
          recievedBy: 'test-receiver',
        },
      },
    };
    expect(dto.namespace).toBe('test');
  });
});
