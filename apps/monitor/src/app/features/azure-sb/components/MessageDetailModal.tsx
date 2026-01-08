import { ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "../../../components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../../../components/ui/sheet"
import { formatBody } from "./messageTable.utils";
import { InfoBlock, Section } from "./MessageDetailSections";
import { Button } from "../../../components/ui/button";
import { ServiceBusMessageRow, TrackingMessage } from "../lib/message.entities";

const MessageDetailModal = ({
    isModalOpen,
    handleModalClose,
    selectedMessage,
    selectedOriginalMessage,
    isBodyExpanded,
    setIsBodyExpanded,
}: {
    isModalOpen: boolean;
    handleModalClose: () => void;
    selectedMessage: ServiceBusMessageRow;
    selectedOriginalMessage: TrackingMessage;
    isBodyExpanded: boolean;
    setIsBodyExpanded: (isBodyExpanded: boolean) => void;
}) => {
    return (
        <Sheet open={isModalOpen} onOpenChange={handleModalClose}>
            <SheetContent className="w-2/6 sm:max-w-4xl overflow-hidden">
                <SheetHeader>
                    <SheetTitle className="text-lg font-semibold">
                        <div className="flex items-center justify-between px-4">
                            <div className="flex items-center gap-2">
                                <label className="block text-sm font-bold uppercase text-gray-700 mb-1">
                                    Service Bus Message Details
                                </label>
                                <Badge variant="outline" className="text-xs">
                                    Azure SB
                                </Badge>
                            </div>
                            {selectedMessage && (
                                <Badge
                                    variant={
                                        selectedMessage.disposition === 'complete'
                                            ? 'default'
                                            : selectedMessage.disposition === 'deadletter'
                                                ? 'destructive'
                                                : selectedMessage.disposition === 'abandon'
                                                    ? 'secondary'
                                                    : 'outline'
                                    }
                                    className="text-sm"
                                >
                                    {selectedMessage.disposition.charAt(0).toUpperCase() +
                                        selectedMessage.disposition.slice(1)}
                                </Badge>
                            )}
                        </div>
                    </SheetTitle>
                </SheetHeader>

                {selectedOriginalMessage && (
                    <div className="overflow-y-auto max-h-[calc(90vh-100px)] space-y-6 p-4">
                        {/* Basic Information */}
                        <Section title="Basic Information">
                            <div className="grid grid-cols-2 gap-4">
                                <InfoBlock
                                    label="Message ID"
                                    value={
                                        <span className="font-mono text-xs">
                                            {selectedOriginalMessage.messageId}
                                        </span>
                                    }
                                />
                                <InfoBlock
                                    label="Queue"
                                    value={selectedOriginalMessage.queue || 'N/A'}
                                />
                                <InfoBlock
                                    label="Status"
                                    value={selectedOriginalMessage.status || 'N/A'}
                                />
                                <InfoBlock
                                    label="Disposition"
                                    value={selectedOriginalMessage.disposition || 'N/A'}
                                />
                            </div>
                        </Section>

                        {/* Sender & Receiver Information */}
                        <Section title="Sender & Receiver">
                            <div className="grid grid-cols-2 gap-4">
                                <InfoBlock
                                    label="Sent By"
                                    value={selectedOriginalMessage.sentBy || 'N/A'}
                                />
                                <InfoBlock
                                    label="Sent At"
                                    value={
                                        selectedOriginalMessage.sentAt
                                            ? new Date(
                                                selectedOriginalMessage.sentAt,
                                            ).toLocaleString()
                                            : 'N/A'
                                    }
                                />
                                <InfoBlock
                                    label="Received By"
                                    value={selectedOriginalMessage.receivedBy || 'N/A'}
                                />
                                <InfoBlock
                                    label="Received At"
                                    value={
                                        selectedOriginalMessage.receivedAt
                                            ? new Date(
                                                selectedOriginalMessage.receivedAt,
                                            ).toLocaleString()
                                            : 'N/A'
                                    }
                                />
                            </div>
                        </Section>

                        {/* Message Body */}
                        <Section title="Message Body">
                            {selectedOriginalMessage.body ? (
                                <>
                                    <div className="flex justify-end mb-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setIsBodyExpanded(!isBodyExpanded)}
                                            className="h-6 px-2 text-xs"
                                        >
                                            {isBodyExpanded ? (
                                                <>
                                                    <ChevronUp className="h-3 w-3 mr-1" /> Hide Body
                                                </>
                                            ) : (
                                                <>
                                                    <ChevronDown className="h-3 w-3 mr-1" /> Show Body
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                    <div
                                        className={`overflow-hidden transition-all duration-300 ${
                                            isBodyExpanded
                                                ? 'max-h-[500px] opacity-100'
                                                : 'max-h-0 opacity-0'
                                        }`}
                                    >
                                        <pre className="text-xs text-gray-900 bg-gray-50 p-4 rounded overflow-x-auto whitespace-pre-wrap">
                                            {formatBody(selectedOriginalMessage.body)}
                                        </pre>
                                    </div>
                                </>
                            ) : (
                                <div className="text-sm text-gray-500 bg-gray-50 p-4 rounded">
                                    No body content
                                </div>
                            )}
                        </Section>
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
};

export default MessageDetailModal;