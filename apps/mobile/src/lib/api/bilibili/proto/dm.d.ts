import * as $protobuf from "protobufjs";
import Long = require("long");

/** Namespace bilibili. */
export namespace bilibili {

    /** Namespace community. */
    namespace community {

        /** Namespace service. */
        namespace service {

            /** Namespace dm. */
            namespace dm {

                /** Namespace v1. */
                namespace v1 {

                    /** Represents a DM */
                    class DM extends $protobuf.rpc.Service {

                        /**
                         * Constructs a new DM service.
                         * @param rpcImpl RPC implementation
                         * @param [requestDelimited=false] Whether requests are length-delimited
                         * @param [responseDelimited=false] Whether responses are length-delimited
                         */
                        constructor(rpcImpl: $protobuf.RPCImpl, requestDelimited?: boolean, responseDelimited?: boolean);

                        /**
                         * Creates new DM service using the specified rpc implementation.
                         * @param rpcImpl RPC implementation
                         * @param [requestDelimited=false] Whether requests are length-delimited
                         * @param [responseDelimited=false] Whether responses are length-delimited
                         * @returns RPC service. Useful where requests and/or responses are streamed.
                         */
                        static create(rpcImpl: $protobuf.RPCImpl, requestDelimited?: boolean, responseDelimited?: boolean): DM;

                        /** Calls DmSegMobile. */
                        dmSegMobile: bilibili.community.service.dm.v1.DM.DmSegMobile;

                        /** Calls DmView. */
                        dmView: bilibili.community.service.dm.v1.DM.DmView;

                        /** Calls DmPlayerConfig. */
                        dmPlayerConfig: bilibili.community.service.dm.v1.DM.DmPlayerConfig;

                        /** Calls DmSegOtt. */
                        dmSegOtt: bilibili.community.service.dm.v1.DM.DmSegOtt;

                        /** Calls DmSegSDK. */
                        dmSegSDK: bilibili.community.service.dm.v1.DM.DmSegSDK;

                        /** Calls DmExpoReport. */
                        dmExpoReport: bilibili.community.service.dm.v1.DM.DmExpoReport;
                    }

                    namespace DM {

                        /**
                         * Callback as used by {@link bilibili.community.service.dm.v1.DM#dmSegMobile}.
                         * @param error Error, if any
                         * @param [response] DmSegMobileReply
                         */
                        type DmSegMobileCallback = (error: (Error|null), response?: bilibili.community.service.dm.v1.DmSegMobileReply) => void;

                        /** Calls DmSegMobile. */
                        type DmSegMobile = {
                          (request: bilibili.community.service.dm.v1.IDmSegMobileReq, callback: bilibili.community.service.dm.v1.DM.DmSegMobileCallback): void;
                          (request: bilibili.community.service.dm.v1.IDmSegMobileReq): Promise<bilibili.community.service.dm.v1.DmSegMobileReply>;
                          readonly name: "DmSegMobile";
                          readonly path: "/bilibili.community.service.dm.v1.DM/DmSegMobile";
                          readonly requestType: "DmSegMobileReq";
                          readonly responseType: "DmSegMobileReply";
                          readonly requestStream: undefined;
                          readonly responseStream: undefined;
                        };

                        /**
                         * Callback as used by {@link bilibili.community.service.dm.v1.DM#dmView}.
                         * @param error Error, if any
                         * @param [response] DmViewReply
                         */
                        type DmViewCallback = (error: (Error|null), response?: bilibili.community.service.dm.v1.DmViewReply) => void;

                        /** Calls DmView. */
                        type DmView = {
                          (request: bilibili.community.service.dm.v1.IDmViewReq, callback: bilibili.community.service.dm.v1.DM.DmViewCallback): void;
                          (request: bilibili.community.service.dm.v1.IDmViewReq): Promise<bilibili.community.service.dm.v1.DmViewReply>;
                          readonly name: "DmView";
                          readonly path: "/bilibili.community.service.dm.v1.DM/DmView";
                          readonly requestType: "DmViewReq";
                          readonly responseType: "DmViewReply";
                          readonly requestStream: undefined;
                          readonly responseStream: undefined;
                        };

                        /**
                         * Callback as used by {@link bilibili.community.service.dm.v1.DM#dmPlayerConfig}.
                         * @param error Error, if any
                         * @param [response] Response
                         */
                        type DmPlayerConfigCallback = (error: (Error|null), response?: bilibili.community.service.dm.v1.Response) => void;

                        /** Calls DmPlayerConfig. */
                        type DmPlayerConfig = {
                          (request: bilibili.community.service.dm.v1.IDmPlayerConfigReq, callback: bilibili.community.service.dm.v1.DM.DmPlayerConfigCallback): void;
                          (request: bilibili.community.service.dm.v1.IDmPlayerConfigReq): Promise<bilibili.community.service.dm.v1.Response>;
                          readonly name: "DmPlayerConfig";
                          readonly path: "/bilibili.community.service.dm.v1.DM/DmPlayerConfig";
                          readonly requestType: "DmPlayerConfigReq";
                          readonly responseType: "Response";
                          readonly requestStream: undefined;
                          readonly responseStream: undefined;
                        };

                        /**
                         * Callback as used by {@link bilibili.community.service.dm.v1.DM#dmSegOtt}.
                         * @param error Error, if any
                         * @param [response] DmSegOttReply
                         */
                        type DmSegOttCallback = (error: (Error|null), response?: bilibili.community.service.dm.v1.DmSegOttReply) => void;

                        /** Calls DmSegOtt. */
                        type DmSegOtt = {
                          (request: bilibili.community.service.dm.v1.IDmSegOttReq, callback: bilibili.community.service.dm.v1.DM.DmSegOttCallback): void;
                          (request: bilibili.community.service.dm.v1.IDmSegOttReq): Promise<bilibili.community.service.dm.v1.DmSegOttReply>;
                          readonly name: "DmSegOtt";
                          readonly path: "/bilibili.community.service.dm.v1.DM/DmSegOtt";
                          readonly requestType: "DmSegOttReq";
                          readonly responseType: "DmSegOttReply";
                          readonly requestStream: undefined;
                          readonly responseStream: undefined;
                        };

                        /**
                         * Callback as used by {@link bilibili.community.service.dm.v1.DM#dmSegSDK}.
                         * @param error Error, if any
                         * @param [response] DmSegSDKReply
                         */
                        type DmSegSDKCallback = (error: (Error|null), response?: bilibili.community.service.dm.v1.DmSegSDKReply) => void;

                        /** Calls DmSegSDK. */
                        type DmSegSDK = {
                          (request: bilibili.community.service.dm.v1.IDmSegSDKReq, callback: bilibili.community.service.dm.v1.DM.DmSegSDKCallback): void;
                          (request: bilibili.community.service.dm.v1.IDmSegSDKReq): Promise<bilibili.community.service.dm.v1.DmSegSDKReply>;
                          readonly name: "DmSegSDK";
                          readonly path: "/bilibili.community.service.dm.v1.DM/DmSegSDK";
                          readonly requestType: "DmSegSDKReq";
                          readonly responseType: "DmSegSDKReply";
                          readonly requestStream: undefined;
                          readonly responseStream: undefined;
                        };

                        /**
                         * Callback as used by {@link bilibili.community.service.dm.v1.DM#dmExpoReport}.
                         * @param error Error, if any
                         * @param [response] DmExpoReportRes
                         */
                        type DmExpoReportCallback = (error: (Error|null), response?: bilibili.community.service.dm.v1.DmExpoReportRes) => void;

                        /** Calls DmExpoReport. */
                        type DmExpoReport = {
                          (request: bilibili.community.service.dm.v1.IDmExpoReportReq, callback: bilibili.community.service.dm.v1.DM.DmExpoReportCallback): void;
                          (request: bilibili.community.service.dm.v1.IDmExpoReportReq): Promise<bilibili.community.service.dm.v1.DmExpoReportRes>;
                          readonly name: "DmExpoReport";
                          readonly path: "/bilibili.community.service.dm.v1.DM/DmExpoReport";
                          readonly requestType: "DmExpoReportReq";
                          readonly responseType: "DmExpoReportRes";
                          readonly requestStream: undefined;
                          readonly responseStream: undefined;
                        };
                    }

                    /**
                     * Properties of an Avatar.
                     * @deprecated Use bilibili.community.service.dm.v1.Avatar.$Properties instead.
                     */
                    interface IAvatar extends bilibili.community.service.dm.v1.Avatar.$Properties {
                    }

                    /** Represents an Avatar. */
                    class Avatar {

                        /**
                         * Constructs a new Avatar.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.Avatar.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** Avatar id. */
                        id: string;

                        /** Avatar url. */
                        url: string;

                        /** Avatar avatarType. */
                        avatarType: bilibili.community.service.dm.v1.AvatarType;

                        /**
                         * Creates a new Avatar instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns Avatar instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.Avatar.$Shape): bilibili.community.service.dm.v1.Avatar & bilibili.community.service.dm.v1.Avatar.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.Avatar.$Properties): bilibili.community.service.dm.v1.Avatar;

                        /**
                         * Encodes the specified Avatar message. Does not implicitly {@link bilibili.community.service.dm.v1.Avatar.verify|verify} messages.
                         * @param message Avatar message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.Avatar.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified Avatar message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.Avatar.verify|verify} messages.
                         * @param message Avatar message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.Avatar.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes an Avatar message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.Avatar & bilibili.community.service.dm.v1.Avatar.$Shape} Avatar
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.Avatar & bilibili.community.service.dm.v1.Avatar.$Shape;

                        /**
                         * Decodes an Avatar message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.Avatar & bilibili.community.service.dm.v1.Avatar.$Shape} Avatar
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.Avatar & bilibili.community.service.dm.v1.Avatar.$Shape;

                        /**
                         * Verifies an Avatar message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates an Avatar message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns Avatar
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.Avatar;

                        /**
                         * Creates a plain object from an Avatar message. Also converts values to other types if specified.
                         * @param message Avatar
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.Avatar, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this Avatar to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for Avatar
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace Avatar {

                        /** Properties of an Avatar. */
                        interface $Properties {

                            /** Avatar id */
                            id?: (string|null);

                            /** Avatar url */
                            url?: (string|null);

                            /** Avatar avatarType */
                            avatarType?: (bilibili.community.service.dm.v1.AvatarType|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of an Avatar. */
                        type $Shape = bilibili.community.service.dm.v1.Avatar.$Properties;
                    }

                    /** AvatarType enum. */
                    enum AvatarType {

                        /** AvatarTypeNone value */
                        AvatarTypeNone = 0,

                        /** AvatarTypeNFT value */
                        AvatarTypeNFT = 1
                    }

                    /**
                     * Properties of a Bubble.
                     * @deprecated Use bilibili.community.service.dm.v1.Bubble.$Properties instead.
                     */
                    interface IBubble extends bilibili.community.service.dm.v1.Bubble.$Properties {
                    }

                    /** Represents a Bubble. */
                    class Bubble {

                        /**
                         * Constructs a new Bubble.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.Bubble.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** Bubble text. */
                        text: string;

                        /** Bubble url. */
                        url: string;

                        /**
                         * Creates a new Bubble instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns Bubble instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.Bubble.$Shape): bilibili.community.service.dm.v1.Bubble & bilibili.community.service.dm.v1.Bubble.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.Bubble.$Properties): bilibili.community.service.dm.v1.Bubble;

                        /**
                         * Encodes the specified Bubble message. Does not implicitly {@link bilibili.community.service.dm.v1.Bubble.verify|verify} messages.
                         * @param message Bubble message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.Bubble.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified Bubble message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.Bubble.verify|verify} messages.
                         * @param message Bubble message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.Bubble.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a Bubble message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.Bubble & bilibili.community.service.dm.v1.Bubble.$Shape} Bubble
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.Bubble & bilibili.community.service.dm.v1.Bubble.$Shape;

                        /**
                         * Decodes a Bubble message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.Bubble & bilibili.community.service.dm.v1.Bubble.$Shape} Bubble
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.Bubble & bilibili.community.service.dm.v1.Bubble.$Shape;

                        /**
                         * Verifies a Bubble message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a Bubble message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns Bubble
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.Bubble;

                        /**
                         * Creates a plain object from a Bubble message. Also converts values to other types if specified.
                         * @param message Bubble
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.Bubble, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this Bubble to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for Bubble
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace Bubble {

                        /** Properties of a Bubble. */
                        interface $Properties {

                            /** Bubble text */
                            text?: (string|null);

                            /** Bubble url */
                            url?: (string|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of a Bubble. */
                        type $Shape = bilibili.community.service.dm.v1.Bubble.$Properties;
                    }

                    /** BubbleType enum. */
                    enum BubbleType {

                        /** BubbleTypeNone value */
                        BubbleTypeNone = 0,

                        /** BubbleTypeClickButton value */
                        BubbleTypeClickButton = 1,

                        /** BubbleTypeDmSettingPanel value */
                        BubbleTypeDmSettingPanel = 2
                    }

                    /**
                     * Properties of a BubbleV2.
                     * @deprecated Use bilibili.community.service.dm.v1.BubbleV2.$Properties instead.
                     */
                    interface IBubbleV2 extends bilibili.community.service.dm.v1.BubbleV2.$Properties {
                    }

                    /** Represents a BubbleV2. */
                    class BubbleV2 {

                        /**
                         * Constructs a new BubbleV2.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.BubbleV2.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** BubbleV2 text. */
                        text: string;

                        /** BubbleV2 url. */
                        url: string;

                        /** BubbleV2 bubbleType. */
                        bubbleType: bilibili.community.service.dm.v1.BubbleType;

                        /** BubbleV2 exposureOnce. */
                        exposureOnce: boolean;

                        /** BubbleV2 exposureType. */
                        exposureType: bilibili.community.service.dm.v1.ExposureType;

                        /**
                         * Creates a new BubbleV2 instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns BubbleV2 instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.BubbleV2.$Shape): bilibili.community.service.dm.v1.BubbleV2 & bilibili.community.service.dm.v1.BubbleV2.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.BubbleV2.$Properties): bilibili.community.service.dm.v1.BubbleV2;

                        /**
                         * Encodes the specified BubbleV2 message. Does not implicitly {@link bilibili.community.service.dm.v1.BubbleV2.verify|verify} messages.
                         * @param message BubbleV2 message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.BubbleV2.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified BubbleV2 message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.BubbleV2.verify|verify} messages.
                         * @param message BubbleV2 message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.BubbleV2.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a BubbleV2 message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.BubbleV2 & bilibili.community.service.dm.v1.BubbleV2.$Shape} BubbleV2
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.BubbleV2 & bilibili.community.service.dm.v1.BubbleV2.$Shape;

                        /**
                         * Decodes a BubbleV2 message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.BubbleV2 & bilibili.community.service.dm.v1.BubbleV2.$Shape} BubbleV2
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.BubbleV2 & bilibili.community.service.dm.v1.BubbleV2.$Shape;

                        /**
                         * Verifies a BubbleV2 message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a BubbleV2 message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns BubbleV2
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.BubbleV2;

                        /**
                         * Creates a plain object from a BubbleV2 message. Also converts values to other types if specified.
                         * @param message BubbleV2
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.BubbleV2, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this BubbleV2 to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for BubbleV2
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace BubbleV2 {

                        /** Properties of a BubbleV2. */
                        interface $Properties {

                            /** BubbleV2 text */
                            text?: (string|null);

                            /** BubbleV2 url */
                            url?: (string|null);

                            /** BubbleV2 bubbleType */
                            bubbleType?: (bilibili.community.service.dm.v1.BubbleType|null);

                            /** BubbleV2 exposureOnce */
                            exposureOnce?: (boolean|null);

                            /** BubbleV2 exposureType */
                            exposureType?: (bilibili.community.service.dm.v1.ExposureType|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of a BubbleV2. */
                        type $Shape = bilibili.community.service.dm.v1.BubbleV2.$Properties;
                    }

                    /**
                     * Properties of a Button.
                     * @deprecated Use bilibili.community.service.dm.v1.Button.$Properties instead.
                     */
                    interface IButton extends bilibili.community.service.dm.v1.Button.$Properties {
                    }

                    /** Represents a Button. */
                    class Button {

                        /**
                         * Constructs a new Button.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.Button.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** Button text. */
                        text: string;

                        /** Button action. */
                        action: number;

                        /**
                         * Creates a new Button instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns Button instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.Button.$Shape): bilibili.community.service.dm.v1.Button & bilibili.community.service.dm.v1.Button.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.Button.$Properties): bilibili.community.service.dm.v1.Button;

                        /**
                         * Encodes the specified Button message. Does not implicitly {@link bilibili.community.service.dm.v1.Button.verify|verify} messages.
                         * @param message Button message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.Button.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified Button message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.Button.verify|verify} messages.
                         * @param message Button message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.Button.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a Button message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.Button & bilibili.community.service.dm.v1.Button.$Shape} Button
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.Button & bilibili.community.service.dm.v1.Button.$Shape;

                        /**
                         * Decodes a Button message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.Button & bilibili.community.service.dm.v1.Button.$Shape} Button
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.Button & bilibili.community.service.dm.v1.Button.$Shape;

                        /**
                         * Verifies a Button message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a Button message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns Button
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.Button;

                        /**
                         * Creates a plain object from a Button message. Also converts values to other types if specified.
                         * @param message Button
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.Button, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this Button to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for Button
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace Button {

                        /** Properties of a Button. */
                        interface $Properties {

                            /** Button text */
                            text?: (string|null);

                            /** Button action */
                            action?: (number|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of a Button. */
                        type $Shape = bilibili.community.service.dm.v1.Button.$Properties;
                    }

                    /**
                     * Properties of a BuzzwordConfig.
                     * @deprecated Use bilibili.community.service.dm.v1.BuzzwordConfig.$Properties instead.
                     */
                    interface IBuzzwordConfig extends bilibili.community.service.dm.v1.BuzzwordConfig.$Properties {
                    }

                    /** Represents a BuzzwordConfig. */
                    class BuzzwordConfig {

                        /**
                         * Constructs a new BuzzwordConfig.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.BuzzwordConfig.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** BuzzwordConfig keywords. */
                        keywords: bilibili.community.service.dm.v1.BuzzwordShowConfig.$Properties[];

                        /**
                         * Creates a new BuzzwordConfig instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns BuzzwordConfig instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.BuzzwordConfig.$Shape): bilibili.community.service.dm.v1.BuzzwordConfig & bilibili.community.service.dm.v1.BuzzwordConfig.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.BuzzwordConfig.$Properties): bilibili.community.service.dm.v1.BuzzwordConfig;

                        /**
                         * Encodes the specified BuzzwordConfig message. Does not implicitly {@link bilibili.community.service.dm.v1.BuzzwordConfig.verify|verify} messages.
                         * @param message BuzzwordConfig message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.BuzzwordConfig.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified BuzzwordConfig message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.BuzzwordConfig.verify|verify} messages.
                         * @param message BuzzwordConfig message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.BuzzwordConfig.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a BuzzwordConfig message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.BuzzwordConfig & bilibili.community.service.dm.v1.BuzzwordConfig.$Shape} BuzzwordConfig
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.BuzzwordConfig & bilibili.community.service.dm.v1.BuzzwordConfig.$Shape;

                        /**
                         * Decodes a BuzzwordConfig message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.BuzzwordConfig & bilibili.community.service.dm.v1.BuzzwordConfig.$Shape} BuzzwordConfig
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.BuzzwordConfig & bilibili.community.service.dm.v1.BuzzwordConfig.$Shape;

                        /**
                         * Verifies a BuzzwordConfig message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a BuzzwordConfig message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns BuzzwordConfig
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.BuzzwordConfig;

                        /**
                         * Creates a plain object from a BuzzwordConfig message. Also converts values to other types if specified.
                         * @param message BuzzwordConfig
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.BuzzwordConfig, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this BuzzwordConfig to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for BuzzwordConfig
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace BuzzwordConfig {

                        /** Properties of a BuzzwordConfig. */
                        interface $Properties {

                            /** BuzzwordConfig keywords */
                            keywords?: (bilibili.community.service.dm.v1.BuzzwordShowConfig.$Properties[]|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of a BuzzwordConfig. */
                        type $Shape = bilibili.community.service.dm.v1.BuzzwordConfig.$Properties;
                    }

                    /**
                     * Properties of a BuzzwordShowConfig.
                     * @deprecated Use bilibili.community.service.dm.v1.BuzzwordShowConfig.$Properties instead.
                     */
                    interface IBuzzwordShowConfig extends bilibili.community.service.dm.v1.BuzzwordShowConfig.$Properties {
                    }

                    /** Represents a BuzzwordShowConfig. */
                    class BuzzwordShowConfig {

                        /**
                         * Constructs a new BuzzwordShowConfig.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.BuzzwordShowConfig.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** BuzzwordShowConfig name. */
                        name: string;

                        /** BuzzwordShowConfig schema. */
                        schema: string;

                        /** BuzzwordShowConfig source. */
                        source: number;

                        /** BuzzwordShowConfig id. */
                        id: (number|Long);

                        /** BuzzwordShowConfig buzzwordId. */
                        buzzwordId: (number|Long);

                        /** BuzzwordShowConfig schemaType. */
                        schemaType: number;

                        /**
                         * Creates a new BuzzwordShowConfig instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns BuzzwordShowConfig instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.BuzzwordShowConfig.$Shape): bilibili.community.service.dm.v1.BuzzwordShowConfig & bilibili.community.service.dm.v1.BuzzwordShowConfig.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.BuzzwordShowConfig.$Properties): bilibili.community.service.dm.v1.BuzzwordShowConfig;

                        /**
                         * Encodes the specified BuzzwordShowConfig message. Does not implicitly {@link bilibili.community.service.dm.v1.BuzzwordShowConfig.verify|verify} messages.
                         * @param message BuzzwordShowConfig message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.BuzzwordShowConfig.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified BuzzwordShowConfig message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.BuzzwordShowConfig.verify|verify} messages.
                         * @param message BuzzwordShowConfig message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.BuzzwordShowConfig.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a BuzzwordShowConfig message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.BuzzwordShowConfig & bilibili.community.service.dm.v1.BuzzwordShowConfig.$Shape} BuzzwordShowConfig
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.BuzzwordShowConfig & bilibili.community.service.dm.v1.BuzzwordShowConfig.$Shape;

                        /**
                         * Decodes a BuzzwordShowConfig message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.BuzzwordShowConfig & bilibili.community.service.dm.v1.BuzzwordShowConfig.$Shape} BuzzwordShowConfig
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.BuzzwordShowConfig & bilibili.community.service.dm.v1.BuzzwordShowConfig.$Shape;

                        /**
                         * Verifies a BuzzwordShowConfig message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a BuzzwordShowConfig message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns BuzzwordShowConfig
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.BuzzwordShowConfig;

                        /**
                         * Creates a plain object from a BuzzwordShowConfig message. Also converts values to other types if specified.
                         * @param message BuzzwordShowConfig
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.BuzzwordShowConfig, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this BuzzwordShowConfig to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for BuzzwordShowConfig
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace BuzzwordShowConfig {

                        /** Properties of a BuzzwordShowConfig. */
                        interface $Properties {

                            /** BuzzwordShowConfig name */
                            name?: (string|null);

                            /** BuzzwordShowConfig schema */
                            schema?: (string|null);

                            /** BuzzwordShowConfig source */
                            source?: (number|null);

                            /** BuzzwordShowConfig id */
                            id?: (number|Long|null);

                            /** BuzzwordShowConfig buzzwordId */
                            buzzwordId?: (number|Long|null);

                            /** BuzzwordShowConfig schemaType */
                            schemaType?: (number|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of a BuzzwordShowConfig. */
                        type $Shape = bilibili.community.service.dm.v1.BuzzwordShowConfig.$Properties;
                    }

                    /**
                     * Properties of a CheckBox.
                     * @deprecated Use bilibili.community.service.dm.v1.CheckBox.$Properties instead.
                     */
                    interface ICheckBox extends bilibili.community.service.dm.v1.CheckBox.$Properties {
                    }

                    /** Represents a CheckBox. */
                    class CheckBox {

                        /**
                         * Constructs a new CheckBox.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.CheckBox.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** CheckBox text. */
                        text: string;

                        /** CheckBox type. */
                        type: bilibili.community.service.dm.v1.CheckboxType;

                        /** CheckBox defaultValue. */
                        defaultValue: boolean;

                        /** CheckBox show. */
                        show: boolean;

                        /**
                         * Creates a new CheckBox instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns CheckBox instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.CheckBox.$Shape): bilibili.community.service.dm.v1.CheckBox & bilibili.community.service.dm.v1.CheckBox.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.CheckBox.$Properties): bilibili.community.service.dm.v1.CheckBox;

                        /**
                         * Encodes the specified CheckBox message. Does not implicitly {@link bilibili.community.service.dm.v1.CheckBox.verify|verify} messages.
                         * @param message CheckBox message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.CheckBox.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified CheckBox message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.CheckBox.verify|verify} messages.
                         * @param message CheckBox message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.CheckBox.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a CheckBox message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.CheckBox & bilibili.community.service.dm.v1.CheckBox.$Shape} CheckBox
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.CheckBox & bilibili.community.service.dm.v1.CheckBox.$Shape;

                        /**
                         * Decodes a CheckBox message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.CheckBox & bilibili.community.service.dm.v1.CheckBox.$Shape} CheckBox
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.CheckBox & bilibili.community.service.dm.v1.CheckBox.$Shape;

                        /**
                         * Verifies a CheckBox message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a CheckBox message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns CheckBox
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.CheckBox;

                        /**
                         * Creates a plain object from a CheckBox message. Also converts values to other types if specified.
                         * @param message CheckBox
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.CheckBox, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this CheckBox to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for CheckBox
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace CheckBox {

                        /** Properties of a CheckBox. */
                        interface $Properties {

                            /** CheckBox text */
                            text?: (string|null);

                            /** CheckBox type */
                            type?: (bilibili.community.service.dm.v1.CheckboxType|null);

                            /** CheckBox defaultValue */
                            defaultValue?: (boolean|null);

                            /** CheckBox show */
                            show?: (boolean|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of a CheckBox. */
                        type $Shape = bilibili.community.service.dm.v1.CheckBox.$Properties;
                    }

                    /** CheckboxType enum. */
                    enum CheckboxType {

                        /** CheckboxTypeNone value */
                        CheckboxTypeNone = 0,

                        /** CheckboxTypeEncourage value */
                        CheckboxTypeEncourage = 1,

                        /** CheckboxTypeColorDM value */
                        CheckboxTypeColorDM = 2
                    }

                    /**
                     * Properties of a CheckBoxV2.
                     * @deprecated Use bilibili.community.service.dm.v1.CheckBoxV2.$Properties instead.
                     */
                    interface ICheckBoxV2 extends bilibili.community.service.dm.v1.CheckBoxV2.$Properties {
                    }

                    /** Represents a CheckBoxV2. */
                    class CheckBoxV2 {

                        /**
                         * Constructs a new CheckBoxV2.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.CheckBoxV2.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** CheckBoxV2 text. */
                        text: string;

                        /** CheckBoxV2 type. */
                        type: number;

                        /** CheckBoxV2 defaultValue. */
                        defaultValue: boolean;

                        /**
                         * Creates a new CheckBoxV2 instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns CheckBoxV2 instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.CheckBoxV2.$Shape): bilibili.community.service.dm.v1.CheckBoxV2 & bilibili.community.service.dm.v1.CheckBoxV2.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.CheckBoxV2.$Properties): bilibili.community.service.dm.v1.CheckBoxV2;

                        /**
                         * Encodes the specified CheckBoxV2 message. Does not implicitly {@link bilibili.community.service.dm.v1.CheckBoxV2.verify|verify} messages.
                         * @param message CheckBoxV2 message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.CheckBoxV2.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified CheckBoxV2 message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.CheckBoxV2.verify|verify} messages.
                         * @param message CheckBoxV2 message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.CheckBoxV2.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a CheckBoxV2 message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.CheckBoxV2 & bilibili.community.service.dm.v1.CheckBoxV2.$Shape} CheckBoxV2
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.CheckBoxV2 & bilibili.community.service.dm.v1.CheckBoxV2.$Shape;

                        /**
                         * Decodes a CheckBoxV2 message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.CheckBoxV2 & bilibili.community.service.dm.v1.CheckBoxV2.$Shape} CheckBoxV2
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.CheckBoxV2 & bilibili.community.service.dm.v1.CheckBoxV2.$Shape;

                        /**
                         * Verifies a CheckBoxV2 message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a CheckBoxV2 message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns CheckBoxV2
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.CheckBoxV2;

                        /**
                         * Creates a plain object from a CheckBoxV2 message. Also converts values to other types if specified.
                         * @param message CheckBoxV2
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.CheckBoxV2, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this CheckBoxV2 to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for CheckBoxV2
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace CheckBoxV2 {

                        /** Properties of a CheckBoxV2. */
                        interface $Properties {

                            /** CheckBoxV2 text */
                            text?: (string|null);

                            /** CheckBoxV2 type */
                            type?: (number|null);

                            /** CheckBoxV2 defaultValue */
                            defaultValue?: (boolean|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of a CheckBoxV2. */
                        type $Shape = bilibili.community.service.dm.v1.CheckBoxV2.$Properties;
                    }

                    /**
                     * Properties of a ClickButton.
                     * @deprecated Use bilibili.community.service.dm.v1.ClickButton.$Properties instead.
                     */
                    interface IClickButton extends bilibili.community.service.dm.v1.ClickButton.$Properties {
                    }

                    /** Represents a ClickButton. */
                    class ClickButton {

                        /**
                         * Constructs a new ClickButton.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.ClickButton.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** ClickButton portraitText. */
                        portraitText: string[];

                        /** ClickButton landscapeText. */
                        landscapeText: string[];

                        /** ClickButton portraitTextFocus. */
                        portraitTextFocus: string[];

                        /** ClickButton landscapeTextFocus. */
                        landscapeTextFocus: string[];

                        /** ClickButton renderType. */
                        renderType: bilibili.community.service.dm.v1.RenderType;

                        /** ClickButton show. */
                        show: boolean;

                        /** ClickButton bubble. */
                        bubble?: (bilibili.community.service.dm.v1.Bubble.$Properties|null);

                        /**
                         * Creates a new ClickButton instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns ClickButton instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.ClickButton.$Shape): bilibili.community.service.dm.v1.ClickButton & bilibili.community.service.dm.v1.ClickButton.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.ClickButton.$Properties): bilibili.community.service.dm.v1.ClickButton;

                        /**
                         * Encodes the specified ClickButton message. Does not implicitly {@link bilibili.community.service.dm.v1.ClickButton.verify|verify} messages.
                         * @param message ClickButton message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.ClickButton.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified ClickButton message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.ClickButton.verify|verify} messages.
                         * @param message ClickButton message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.ClickButton.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a ClickButton message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.ClickButton & bilibili.community.service.dm.v1.ClickButton.$Shape} ClickButton
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.ClickButton & bilibili.community.service.dm.v1.ClickButton.$Shape;

                        /**
                         * Decodes a ClickButton message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.ClickButton & bilibili.community.service.dm.v1.ClickButton.$Shape} ClickButton
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.ClickButton & bilibili.community.service.dm.v1.ClickButton.$Shape;

                        /**
                         * Verifies a ClickButton message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a ClickButton message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns ClickButton
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.ClickButton;

                        /**
                         * Creates a plain object from a ClickButton message. Also converts values to other types if specified.
                         * @param message ClickButton
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.ClickButton, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this ClickButton to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for ClickButton
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace ClickButton {

                        /** Properties of a ClickButton. */
                        interface $Properties {

                            /** ClickButton portraitText */
                            portraitText?: (string[]|null);

                            /** ClickButton landscapeText */
                            landscapeText?: (string[]|null);

                            /** ClickButton portraitTextFocus */
                            portraitTextFocus?: (string[]|null);

                            /** ClickButton landscapeTextFocus */
                            landscapeTextFocus?: (string[]|null);

                            /** ClickButton renderType */
                            renderType?: (bilibili.community.service.dm.v1.RenderType|null);

                            /** ClickButton show */
                            show?: (boolean|null);

                            /** ClickButton bubble */
                            bubble?: (bilibili.community.service.dm.v1.Bubble.$Properties|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of a ClickButton. */
                        type $Shape = bilibili.community.service.dm.v1.ClickButton.$Properties;
                    }

                    /**
                     * Properties of a ClickButtonV2.
                     * @deprecated Use bilibili.community.service.dm.v1.ClickButtonV2.$Properties instead.
                     */
                    interface IClickButtonV2 extends bilibili.community.service.dm.v1.ClickButtonV2.$Properties {
                    }

                    /** Represents a ClickButtonV2. */
                    class ClickButtonV2 {

                        /**
                         * Constructs a new ClickButtonV2.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.ClickButtonV2.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** ClickButtonV2 portraitText. */
                        portraitText: string[];

                        /** ClickButtonV2 landscapeText. */
                        landscapeText: string[];

                        /** ClickButtonV2 portraitTextFocus. */
                        portraitTextFocus: string[];

                        /** ClickButtonV2 landscapeTextFocus. */
                        landscapeTextFocus: string[];

                        /** ClickButtonV2 renderType. */
                        renderType: number;

                        /** ClickButtonV2 textInputPost. */
                        textInputPost: boolean;

                        /** ClickButtonV2 exposureOnce. */
                        exposureOnce: boolean;

                        /** ClickButtonV2 exposureType. */
                        exposureType: number;

                        /**
                         * Creates a new ClickButtonV2 instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns ClickButtonV2 instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.ClickButtonV2.$Shape): bilibili.community.service.dm.v1.ClickButtonV2 & bilibili.community.service.dm.v1.ClickButtonV2.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.ClickButtonV2.$Properties): bilibili.community.service.dm.v1.ClickButtonV2;

                        /**
                         * Encodes the specified ClickButtonV2 message. Does not implicitly {@link bilibili.community.service.dm.v1.ClickButtonV2.verify|verify} messages.
                         * @param message ClickButtonV2 message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.ClickButtonV2.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified ClickButtonV2 message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.ClickButtonV2.verify|verify} messages.
                         * @param message ClickButtonV2 message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.ClickButtonV2.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a ClickButtonV2 message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.ClickButtonV2 & bilibili.community.service.dm.v1.ClickButtonV2.$Shape} ClickButtonV2
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.ClickButtonV2 & bilibili.community.service.dm.v1.ClickButtonV2.$Shape;

                        /**
                         * Decodes a ClickButtonV2 message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.ClickButtonV2 & bilibili.community.service.dm.v1.ClickButtonV2.$Shape} ClickButtonV2
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.ClickButtonV2 & bilibili.community.service.dm.v1.ClickButtonV2.$Shape;

                        /**
                         * Verifies a ClickButtonV2 message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a ClickButtonV2 message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns ClickButtonV2
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.ClickButtonV2;

                        /**
                         * Creates a plain object from a ClickButtonV2 message. Also converts values to other types if specified.
                         * @param message ClickButtonV2
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.ClickButtonV2, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this ClickButtonV2 to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for ClickButtonV2
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace ClickButtonV2 {

                        /** Properties of a ClickButtonV2. */
                        interface $Properties {

                            /** ClickButtonV2 portraitText */
                            portraitText?: (string[]|null);

                            /** ClickButtonV2 landscapeText */
                            landscapeText?: (string[]|null);

                            /** ClickButtonV2 portraitTextFocus */
                            portraitTextFocus?: (string[]|null);

                            /** ClickButtonV2 landscapeTextFocus */
                            landscapeTextFocus?: (string[]|null);

                            /** ClickButtonV2 renderType */
                            renderType?: (number|null);

                            /** ClickButtonV2 textInputPost */
                            textInputPost?: (boolean|null);

                            /** ClickButtonV2 exposureOnce */
                            exposureOnce?: (boolean|null);

                            /** ClickButtonV2 exposureType */
                            exposureType?: (number|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of a ClickButtonV2. */
                        type $Shape = bilibili.community.service.dm.v1.ClickButtonV2.$Properties;
                    }

                    /**
                     * Properties of a CommandDm.
                     * @deprecated Use bilibili.community.service.dm.v1.CommandDm.$Properties instead.
                     */
                    interface ICommandDm extends bilibili.community.service.dm.v1.CommandDm.$Properties {
                    }

                    /** Represents a CommandDm. */
                    class CommandDm {

                        /**
                         * Constructs a new CommandDm.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.CommandDm.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** CommandDm id. */
                        id: (number|Long);

                        /** CommandDm oid. */
                        oid: (number|Long);

                        /** CommandDm mid. */
                        mid: string;

                        /** CommandDm command. */
                        command: string;

                        /** CommandDm content. */
                        content: string;

                        /** CommandDm progress. */
                        progress: number;

                        /** CommandDm ctime. */
                        ctime: string;

                        /** CommandDm mtime. */
                        mtime: string;

                        /** CommandDm extra. */
                        extra: string;

                        /** CommandDm idStr. */
                        idStr: string;

                        /**
                         * Creates a new CommandDm instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns CommandDm instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.CommandDm.$Shape): bilibili.community.service.dm.v1.CommandDm & bilibili.community.service.dm.v1.CommandDm.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.CommandDm.$Properties): bilibili.community.service.dm.v1.CommandDm;

                        /**
                         * Encodes the specified CommandDm message. Does not implicitly {@link bilibili.community.service.dm.v1.CommandDm.verify|verify} messages.
                         * @param message CommandDm message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.CommandDm.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified CommandDm message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.CommandDm.verify|verify} messages.
                         * @param message CommandDm message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.CommandDm.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a CommandDm message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.CommandDm & bilibili.community.service.dm.v1.CommandDm.$Shape} CommandDm
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.CommandDm & bilibili.community.service.dm.v1.CommandDm.$Shape;

                        /**
                         * Decodes a CommandDm message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.CommandDm & bilibili.community.service.dm.v1.CommandDm.$Shape} CommandDm
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.CommandDm & bilibili.community.service.dm.v1.CommandDm.$Shape;

                        /**
                         * Verifies a CommandDm message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a CommandDm message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns CommandDm
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.CommandDm;

                        /**
                         * Creates a plain object from a CommandDm message. Also converts values to other types if specified.
                         * @param message CommandDm
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.CommandDm, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this CommandDm to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for CommandDm
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace CommandDm {

                        /** Properties of a CommandDm. */
                        interface $Properties {

                            /** CommandDm id */
                            id?: (number|Long|null);

                            /** CommandDm oid */
                            oid?: (number|Long|null);

                            /** CommandDm mid */
                            mid?: (string|null);

                            /** CommandDm command */
                            command?: (string|null);

                            /** CommandDm content */
                            content?: (string|null);

                            /** CommandDm progress */
                            progress?: (number|null);

                            /** CommandDm ctime */
                            ctime?: (string|null);

                            /** CommandDm mtime */
                            mtime?: (string|null);

                            /** CommandDm extra */
                            extra?: (string|null);

                            /** CommandDm idStr */
                            idStr?: (string|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of a CommandDm. */
                        type $Shape = bilibili.community.service.dm.v1.CommandDm.$Properties;
                    }

                    /**
                     * Properties of a DanmakuAIFlag.
                     * @deprecated Use bilibili.community.service.dm.v1.DanmakuAIFlag.$Properties instead.
                     */
                    interface IDanmakuAIFlag extends bilibili.community.service.dm.v1.DanmakuAIFlag.$Properties {
                    }

                    /** Represents a DanmakuAIFlag. */
                    class DanmakuAIFlag {

                        /**
                         * Constructs a new DanmakuAIFlag.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.DanmakuAIFlag.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** DanmakuAIFlag dmFlags. */
                        dmFlags: bilibili.community.service.dm.v1.DanmakuFlag.$Properties[];

                        /**
                         * Creates a new DanmakuAIFlag instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns DanmakuAIFlag instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.DanmakuAIFlag.$Shape): bilibili.community.service.dm.v1.DanmakuAIFlag & bilibili.community.service.dm.v1.DanmakuAIFlag.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.DanmakuAIFlag.$Properties): bilibili.community.service.dm.v1.DanmakuAIFlag;

                        /**
                         * Encodes the specified DanmakuAIFlag message. Does not implicitly {@link bilibili.community.service.dm.v1.DanmakuAIFlag.verify|verify} messages.
                         * @param message DanmakuAIFlag message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.DanmakuAIFlag.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified DanmakuAIFlag message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.DanmakuAIFlag.verify|verify} messages.
                         * @param message DanmakuAIFlag message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.DanmakuAIFlag.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a DanmakuAIFlag message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.DanmakuAIFlag & bilibili.community.service.dm.v1.DanmakuAIFlag.$Shape} DanmakuAIFlag
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.DanmakuAIFlag & bilibili.community.service.dm.v1.DanmakuAIFlag.$Shape;

                        /**
                         * Decodes a DanmakuAIFlag message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.DanmakuAIFlag & bilibili.community.service.dm.v1.DanmakuAIFlag.$Shape} DanmakuAIFlag
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.DanmakuAIFlag & bilibili.community.service.dm.v1.DanmakuAIFlag.$Shape;

                        /**
                         * Verifies a DanmakuAIFlag message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a DanmakuAIFlag message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns DanmakuAIFlag
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.DanmakuAIFlag;

                        /**
                         * Creates a plain object from a DanmakuAIFlag message. Also converts values to other types if specified.
                         * @param message DanmakuAIFlag
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.DanmakuAIFlag, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this DanmakuAIFlag to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for DanmakuAIFlag
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace DanmakuAIFlag {

                        /** Properties of a DanmakuAIFlag. */
                        interface $Properties {

                            /** DanmakuAIFlag dmFlags */
                            dmFlags?: (bilibili.community.service.dm.v1.DanmakuFlag.$Properties[]|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of a DanmakuAIFlag. */
                        type $Shape = bilibili.community.service.dm.v1.DanmakuAIFlag.$Properties;
                    }

                    /**
                     * Properties of a DanmakuElem.
                     * @deprecated Use bilibili.community.service.dm.v1.DanmakuElem.$Properties instead.
                     */
                    interface IDanmakuElem extends bilibili.community.service.dm.v1.DanmakuElem.$Properties {
                    }

                    /** Represents a DanmakuElem. */
                    class DanmakuElem {

                        /**
                         * Constructs a new DanmakuElem.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.DanmakuElem.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** DanmakuElem id. */
                        id: (number|Long);

                        /** DanmakuElem progress. */
                        progress: number;

                        /** DanmakuElem mode. */
                        mode: number;

                        /** DanmakuElem fontsize. */
                        fontsize: number;

                        /** DanmakuElem color. */
                        color: number;

                        /** DanmakuElem midHash. */
                        midHash: string;

                        /** DanmakuElem content. */
                        content: string;

                        /** DanmakuElem ctime. */
                        ctime: (number|Long);

                        /** DanmakuElem weight. */
                        weight: number;

                        /** DanmakuElem action. */
                        action: string;

                        /** DanmakuElem pool. */
                        pool: number;

                        /** DanmakuElem idStr. */
                        idStr: string;

                        /** DanmakuElem attr. */
                        attr: number;

                        /** DanmakuElem animation. */
                        animation: string;

                        /** DanmakuElem colorful. */
                        colorful: bilibili.community.service.dm.v1.DmColorfulType;

                        /**
                         * Creates a new DanmakuElem instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns DanmakuElem instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.DanmakuElem.$Shape): bilibili.community.service.dm.v1.DanmakuElem & bilibili.community.service.dm.v1.DanmakuElem.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.DanmakuElem.$Properties): bilibili.community.service.dm.v1.DanmakuElem;

                        /**
                         * Encodes the specified DanmakuElem message. Does not implicitly {@link bilibili.community.service.dm.v1.DanmakuElem.verify|verify} messages.
                         * @param message DanmakuElem message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.DanmakuElem.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified DanmakuElem message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.DanmakuElem.verify|verify} messages.
                         * @param message DanmakuElem message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.DanmakuElem.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a DanmakuElem message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.DanmakuElem & bilibili.community.service.dm.v1.DanmakuElem.$Shape} DanmakuElem
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.DanmakuElem & bilibili.community.service.dm.v1.DanmakuElem.$Shape;

                        /**
                         * Decodes a DanmakuElem message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.DanmakuElem & bilibili.community.service.dm.v1.DanmakuElem.$Shape} DanmakuElem
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.DanmakuElem & bilibili.community.service.dm.v1.DanmakuElem.$Shape;

                        /**
                         * Verifies a DanmakuElem message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a DanmakuElem message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns DanmakuElem
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.DanmakuElem;

                        /**
                         * Creates a plain object from a DanmakuElem message. Also converts values to other types if specified.
                         * @param message DanmakuElem
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.DanmakuElem, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this DanmakuElem to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for DanmakuElem
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace DanmakuElem {

                        /** Properties of a DanmakuElem. */
                        interface $Properties {

                            /** DanmakuElem id */
                            id?: (number|Long|null);

                            /** DanmakuElem progress */
                            progress?: (number|null);

                            /** DanmakuElem mode */
                            mode?: (number|null);

                            /** DanmakuElem fontsize */
                            fontsize?: (number|null);

                            /** DanmakuElem color */
                            color?: (number|null);

                            /** DanmakuElem midHash */
                            midHash?: (string|null);

                            /** DanmakuElem content */
                            content?: (string|null);

                            /** DanmakuElem ctime */
                            ctime?: (number|Long|null);

                            /** DanmakuElem weight */
                            weight?: (number|null);

                            /** DanmakuElem action */
                            action?: (string|null);

                            /** DanmakuElem pool */
                            pool?: (number|null);

                            /** DanmakuElem idStr */
                            idStr?: (string|null);

                            /** DanmakuElem attr */
                            attr?: (number|null);

                            /** DanmakuElem animation */
                            animation?: (string|null);

                            /** DanmakuElem colorful */
                            colorful?: (bilibili.community.service.dm.v1.DmColorfulType|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of a DanmakuElem. */
                        type $Shape = bilibili.community.service.dm.v1.DanmakuElem.$Properties;
                    }

                    /**
                     * Properties of a DanmakuFlag.
                     * @deprecated Use bilibili.community.service.dm.v1.DanmakuFlag.$Properties instead.
                     */
                    interface IDanmakuFlag extends bilibili.community.service.dm.v1.DanmakuFlag.$Properties {
                    }

                    /** Represents a DanmakuFlag. */
                    class DanmakuFlag {

                        /**
                         * Constructs a new DanmakuFlag.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.DanmakuFlag.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** DanmakuFlag dmid. */
                        dmid: (number|Long);

                        /** DanmakuFlag flag. */
                        flag: number;

                        /**
                         * Creates a new DanmakuFlag instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns DanmakuFlag instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.DanmakuFlag.$Shape): bilibili.community.service.dm.v1.DanmakuFlag & bilibili.community.service.dm.v1.DanmakuFlag.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.DanmakuFlag.$Properties): bilibili.community.service.dm.v1.DanmakuFlag;

                        /**
                         * Encodes the specified DanmakuFlag message. Does not implicitly {@link bilibili.community.service.dm.v1.DanmakuFlag.verify|verify} messages.
                         * @param message DanmakuFlag message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.DanmakuFlag.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified DanmakuFlag message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.DanmakuFlag.verify|verify} messages.
                         * @param message DanmakuFlag message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.DanmakuFlag.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a DanmakuFlag message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.DanmakuFlag & bilibili.community.service.dm.v1.DanmakuFlag.$Shape} DanmakuFlag
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.DanmakuFlag & bilibili.community.service.dm.v1.DanmakuFlag.$Shape;

                        /**
                         * Decodes a DanmakuFlag message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.DanmakuFlag & bilibili.community.service.dm.v1.DanmakuFlag.$Shape} DanmakuFlag
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.DanmakuFlag & bilibili.community.service.dm.v1.DanmakuFlag.$Shape;

                        /**
                         * Verifies a DanmakuFlag message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a DanmakuFlag message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns DanmakuFlag
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.DanmakuFlag;

                        /**
                         * Creates a plain object from a DanmakuFlag message. Also converts values to other types if specified.
                         * @param message DanmakuFlag
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.DanmakuFlag, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this DanmakuFlag to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for DanmakuFlag
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace DanmakuFlag {

                        /** Properties of a DanmakuFlag. */
                        interface $Properties {

                            /** DanmakuFlag dmid */
                            dmid?: (number|Long|null);

                            /** DanmakuFlag flag */
                            flag?: (number|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of a DanmakuFlag. */
                        type $Shape = bilibili.community.service.dm.v1.DanmakuFlag.$Properties;
                    }

                    /**
                     * Properties of a DanmakuFlagConfig.
                     * @deprecated Use bilibili.community.service.dm.v1.DanmakuFlagConfig.$Properties instead.
                     */
                    interface IDanmakuFlagConfig extends bilibili.community.service.dm.v1.DanmakuFlagConfig.$Properties {
                    }

                    /** Represents a DanmakuFlagConfig. */
                    class DanmakuFlagConfig {

                        /**
                         * Constructs a new DanmakuFlagConfig.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.DanmakuFlagConfig.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** DanmakuFlagConfig recFlag. */
                        recFlag: number;

                        /** DanmakuFlagConfig recText. */
                        recText: string;

                        /** DanmakuFlagConfig recSwitch. */
                        recSwitch: number;

                        /**
                         * Creates a new DanmakuFlagConfig instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns DanmakuFlagConfig instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.DanmakuFlagConfig.$Shape): bilibili.community.service.dm.v1.DanmakuFlagConfig & bilibili.community.service.dm.v1.DanmakuFlagConfig.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.DanmakuFlagConfig.$Properties): bilibili.community.service.dm.v1.DanmakuFlagConfig;

                        /**
                         * Encodes the specified DanmakuFlagConfig message. Does not implicitly {@link bilibili.community.service.dm.v1.DanmakuFlagConfig.verify|verify} messages.
                         * @param message DanmakuFlagConfig message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.DanmakuFlagConfig.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified DanmakuFlagConfig message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.DanmakuFlagConfig.verify|verify} messages.
                         * @param message DanmakuFlagConfig message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.DanmakuFlagConfig.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a DanmakuFlagConfig message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.DanmakuFlagConfig & bilibili.community.service.dm.v1.DanmakuFlagConfig.$Shape} DanmakuFlagConfig
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.DanmakuFlagConfig & bilibili.community.service.dm.v1.DanmakuFlagConfig.$Shape;

                        /**
                         * Decodes a DanmakuFlagConfig message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.DanmakuFlagConfig & bilibili.community.service.dm.v1.DanmakuFlagConfig.$Shape} DanmakuFlagConfig
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.DanmakuFlagConfig & bilibili.community.service.dm.v1.DanmakuFlagConfig.$Shape;

                        /**
                         * Verifies a DanmakuFlagConfig message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a DanmakuFlagConfig message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns DanmakuFlagConfig
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.DanmakuFlagConfig;

                        /**
                         * Creates a plain object from a DanmakuFlagConfig message. Also converts values to other types if specified.
                         * @param message DanmakuFlagConfig
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.DanmakuFlagConfig, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this DanmakuFlagConfig to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for DanmakuFlagConfig
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace DanmakuFlagConfig {

                        /** Properties of a DanmakuFlagConfig. */
                        interface $Properties {

                            /** DanmakuFlagConfig recFlag */
                            recFlag?: (number|null);

                            /** DanmakuFlagConfig recText */
                            recText?: (string|null);

                            /** DanmakuFlagConfig recSwitch */
                            recSwitch?: (number|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of a DanmakuFlagConfig. */
                        type $Shape = bilibili.community.service.dm.v1.DanmakuFlagConfig.$Properties;
                    }

                    /**
                     * Properties of a DanmuDefaultPlayerConfig.
                     * @deprecated Use bilibili.community.service.dm.v1.DanmuDefaultPlayerConfig.$Properties instead.
                     */
                    interface IDanmuDefaultPlayerConfig extends bilibili.community.service.dm.v1.DanmuDefaultPlayerConfig.$Properties {
                    }

                    /** Represents a DanmuDefaultPlayerConfig. */
                    class DanmuDefaultPlayerConfig {

                        /**
                         * Constructs a new DanmuDefaultPlayerConfig.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.DanmuDefaultPlayerConfig.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** DanmuDefaultPlayerConfig playerDanmakuUseDefaultConfig. */
                        playerDanmakuUseDefaultConfig: boolean;

                        /** DanmuDefaultPlayerConfig playerDanmakuAiRecommendedSwitch. */
                        playerDanmakuAiRecommendedSwitch: boolean;

                        /** DanmuDefaultPlayerConfig playerDanmakuAiRecommendedLevel. */
                        playerDanmakuAiRecommendedLevel: number;

                        /** DanmuDefaultPlayerConfig playerDanmakuBlocktop. */
                        playerDanmakuBlocktop: boolean;

                        /** DanmuDefaultPlayerConfig playerDanmakuBlockscroll. */
                        playerDanmakuBlockscroll: boolean;

                        /** DanmuDefaultPlayerConfig playerDanmakuBlockbottom. */
                        playerDanmakuBlockbottom: boolean;

                        /** DanmuDefaultPlayerConfig playerDanmakuBlockcolorful. */
                        playerDanmakuBlockcolorful: boolean;

                        /** DanmuDefaultPlayerConfig playerDanmakuBlockrepeat. */
                        playerDanmakuBlockrepeat: boolean;

                        /** DanmuDefaultPlayerConfig playerDanmakuBlockspecial. */
                        playerDanmakuBlockspecial: boolean;

                        /** DanmuDefaultPlayerConfig playerDanmakuOpacity. */
                        playerDanmakuOpacity: number;

                        /** DanmuDefaultPlayerConfig playerDanmakuScalingfactor. */
                        playerDanmakuScalingfactor: number;

                        /** DanmuDefaultPlayerConfig playerDanmakuDomain. */
                        playerDanmakuDomain: number;

                        /** DanmuDefaultPlayerConfig playerDanmakuSpeed. */
                        playerDanmakuSpeed: number;

                        /** DanmuDefaultPlayerConfig inlinePlayerDanmakuSwitch. */
                        inlinePlayerDanmakuSwitch: boolean;

                        /** DanmuDefaultPlayerConfig playerDanmakuSeniorModeSwitch. */
                        playerDanmakuSeniorModeSwitch: number;

                        /** DanmuDefaultPlayerConfig playerDanmakuAiRecommendedLevelV2. */
                        playerDanmakuAiRecommendedLevelV2: number;

                        /** DanmuDefaultPlayerConfig playerDanmakuAiRecommendedLevelV2Map. */
                        playerDanmakuAiRecommendedLevelV2Map: { [k: string]: number };

                        /**
                         * Creates a new DanmuDefaultPlayerConfig instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns DanmuDefaultPlayerConfig instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.DanmuDefaultPlayerConfig.$Shape): bilibili.community.service.dm.v1.DanmuDefaultPlayerConfig & bilibili.community.service.dm.v1.DanmuDefaultPlayerConfig.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.DanmuDefaultPlayerConfig.$Properties): bilibili.community.service.dm.v1.DanmuDefaultPlayerConfig;

                        /**
                         * Encodes the specified DanmuDefaultPlayerConfig message. Does not implicitly {@link bilibili.community.service.dm.v1.DanmuDefaultPlayerConfig.verify|verify} messages.
                         * @param message DanmuDefaultPlayerConfig message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.DanmuDefaultPlayerConfig.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified DanmuDefaultPlayerConfig message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.DanmuDefaultPlayerConfig.verify|verify} messages.
                         * @param message DanmuDefaultPlayerConfig message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.DanmuDefaultPlayerConfig.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a DanmuDefaultPlayerConfig message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.DanmuDefaultPlayerConfig & bilibili.community.service.dm.v1.DanmuDefaultPlayerConfig.$Shape} DanmuDefaultPlayerConfig
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.DanmuDefaultPlayerConfig & bilibili.community.service.dm.v1.DanmuDefaultPlayerConfig.$Shape;

                        /**
                         * Decodes a DanmuDefaultPlayerConfig message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.DanmuDefaultPlayerConfig & bilibili.community.service.dm.v1.DanmuDefaultPlayerConfig.$Shape} DanmuDefaultPlayerConfig
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.DanmuDefaultPlayerConfig & bilibili.community.service.dm.v1.DanmuDefaultPlayerConfig.$Shape;

                        /**
                         * Verifies a DanmuDefaultPlayerConfig message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a DanmuDefaultPlayerConfig message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns DanmuDefaultPlayerConfig
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.DanmuDefaultPlayerConfig;

                        /**
                         * Creates a plain object from a DanmuDefaultPlayerConfig message. Also converts values to other types if specified.
                         * @param message DanmuDefaultPlayerConfig
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.DanmuDefaultPlayerConfig, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this DanmuDefaultPlayerConfig to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for DanmuDefaultPlayerConfig
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace DanmuDefaultPlayerConfig {

                        /** Properties of a DanmuDefaultPlayerConfig. */
                        interface $Properties {

                            /** DanmuDefaultPlayerConfig playerDanmakuUseDefaultConfig */
                            playerDanmakuUseDefaultConfig?: (boolean|null);

                            /** DanmuDefaultPlayerConfig playerDanmakuAiRecommendedSwitch */
                            playerDanmakuAiRecommendedSwitch?: (boolean|null);

                            /** DanmuDefaultPlayerConfig playerDanmakuAiRecommendedLevel */
                            playerDanmakuAiRecommendedLevel?: (number|null);

                            /** DanmuDefaultPlayerConfig playerDanmakuBlocktop */
                            playerDanmakuBlocktop?: (boolean|null);

                            /** DanmuDefaultPlayerConfig playerDanmakuBlockscroll */
                            playerDanmakuBlockscroll?: (boolean|null);

                            /** DanmuDefaultPlayerConfig playerDanmakuBlockbottom */
                            playerDanmakuBlockbottom?: (boolean|null);

                            /** DanmuDefaultPlayerConfig playerDanmakuBlockcolorful */
                            playerDanmakuBlockcolorful?: (boolean|null);

                            /** DanmuDefaultPlayerConfig playerDanmakuBlockrepeat */
                            playerDanmakuBlockrepeat?: (boolean|null);

                            /** DanmuDefaultPlayerConfig playerDanmakuBlockspecial */
                            playerDanmakuBlockspecial?: (boolean|null);

                            /** DanmuDefaultPlayerConfig playerDanmakuOpacity */
                            playerDanmakuOpacity?: (number|null);

                            /** DanmuDefaultPlayerConfig playerDanmakuScalingfactor */
                            playerDanmakuScalingfactor?: (number|null);

                            /** DanmuDefaultPlayerConfig playerDanmakuDomain */
                            playerDanmakuDomain?: (number|null);

                            /** DanmuDefaultPlayerConfig playerDanmakuSpeed */
                            playerDanmakuSpeed?: (number|null);

                            /** DanmuDefaultPlayerConfig inlinePlayerDanmakuSwitch */
                            inlinePlayerDanmakuSwitch?: (boolean|null);

                            /** DanmuDefaultPlayerConfig playerDanmakuSeniorModeSwitch */
                            playerDanmakuSeniorModeSwitch?: (number|null);

                            /** DanmuDefaultPlayerConfig playerDanmakuAiRecommendedLevelV2 */
                            playerDanmakuAiRecommendedLevelV2?: (number|null);

                            /** DanmuDefaultPlayerConfig playerDanmakuAiRecommendedLevelV2Map */
                            playerDanmakuAiRecommendedLevelV2Map?: ({ [k: string]: number }|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of a DanmuDefaultPlayerConfig. */
                        type $Shape = bilibili.community.service.dm.v1.DanmuDefaultPlayerConfig.$Properties;
                    }

                    /**
                     * Properties of a DanmuPlayerConfig.
                     * @deprecated Use bilibili.community.service.dm.v1.DanmuPlayerConfig.$Properties instead.
                     */
                    interface IDanmuPlayerConfig extends bilibili.community.service.dm.v1.DanmuPlayerConfig.$Properties {
                    }

                    /** Represents a DanmuPlayerConfig. */
                    class DanmuPlayerConfig {

                        /**
                         * Constructs a new DanmuPlayerConfig.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.DanmuPlayerConfig.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** DanmuPlayerConfig playerDanmakuSwitch. */
                        playerDanmakuSwitch: boolean;

                        /** DanmuPlayerConfig playerDanmakuSwitchSave. */
                        playerDanmakuSwitchSave: boolean;

                        /** DanmuPlayerConfig playerDanmakuUseDefaultConfig. */
                        playerDanmakuUseDefaultConfig: boolean;

                        /** DanmuPlayerConfig playerDanmakuAiRecommendedSwitch. */
                        playerDanmakuAiRecommendedSwitch: boolean;

                        /** DanmuPlayerConfig playerDanmakuAiRecommendedLevel. */
                        playerDanmakuAiRecommendedLevel: number;

                        /** DanmuPlayerConfig playerDanmakuBlocktop. */
                        playerDanmakuBlocktop: boolean;

                        /** DanmuPlayerConfig playerDanmakuBlockscroll. */
                        playerDanmakuBlockscroll: boolean;

                        /** DanmuPlayerConfig playerDanmakuBlockbottom. */
                        playerDanmakuBlockbottom: boolean;

                        /** DanmuPlayerConfig playerDanmakuBlockcolorful. */
                        playerDanmakuBlockcolorful: boolean;

                        /** DanmuPlayerConfig playerDanmakuBlockrepeat. */
                        playerDanmakuBlockrepeat: boolean;

                        /** DanmuPlayerConfig playerDanmakuBlockspecial. */
                        playerDanmakuBlockspecial: boolean;

                        /** DanmuPlayerConfig playerDanmakuOpacity. */
                        playerDanmakuOpacity: number;

                        /** DanmuPlayerConfig playerDanmakuScalingfactor. */
                        playerDanmakuScalingfactor: number;

                        /** DanmuPlayerConfig playerDanmakuDomain. */
                        playerDanmakuDomain: number;

                        /** DanmuPlayerConfig playerDanmakuSpeed. */
                        playerDanmakuSpeed: number;

                        /** DanmuPlayerConfig playerDanmakuEnableblocklist. */
                        playerDanmakuEnableblocklist: boolean;

                        /** DanmuPlayerConfig inlinePlayerDanmakuSwitch. */
                        inlinePlayerDanmakuSwitch: boolean;

                        /** DanmuPlayerConfig inlinePlayerDanmakuConfig. */
                        inlinePlayerDanmakuConfig: number;

                        /** DanmuPlayerConfig playerDanmakuIosSwitchSave. */
                        playerDanmakuIosSwitchSave: number;

                        /** DanmuPlayerConfig playerDanmakuSeniorModeSwitch. */
                        playerDanmakuSeniorModeSwitch: number;

                        /** DanmuPlayerConfig playerDanmakuAiRecommendedLevelV2. */
                        playerDanmakuAiRecommendedLevelV2: number;

                        /** DanmuPlayerConfig playerDanmakuAiRecommendedLevelV2Map. */
                        playerDanmakuAiRecommendedLevelV2Map: { [k: string]: number };

                        /**
                         * Creates a new DanmuPlayerConfig instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns DanmuPlayerConfig instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.DanmuPlayerConfig.$Shape): bilibili.community.service.dm.v1.DanmuPlayerConfig & bilibili.community.service.dm.v1.DanmuPlayerConfig.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.DanmuPlayerConfig.$Properties): bilibili.community.service.dm.v1.DanmuPlayerConfig;

                        /**
                         * Encodes the specified DanmuPlayerConfig message. Does not implicitly {@link bilibili.community.service.dm.v1.DanmuPlayerConfig.verify|verify} messages.
                         * @param message DanmuPlayerConfig message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.DanmuPlayerConfig.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified DanmuPlayerConfig message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.DanmuPlayerConfig.verify|verify} messages.
                         * @param message DanmuPlayerConfig message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.DanmuPlayerConfig.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a DanmuPlayerConfig message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.DanmuPlayerConfig & bilibili.community.service.dm.v1.DanmuPlayerConfig.$Shape} DanmuPlayerConfig
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.DanmuPlayerConfig & bilibili.community.service.dm.v1.DanmuPlayerConfig.$Shape;

                        /**
                         * Decodes a DanmuPlayerConfig message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.DanmuPlayerConfig & bilibili.community.service.dm.v1.DanmuPlayerConfig.$Shape} DanmuPlayerConfig
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.DanmuPlayerConfig & bilibili.community.service.dm.v1.DanmuPlayerConfig.$Shape;

                        /**
                         * Verifies a DanmuPlayerConfig message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a DanmuPlayerConfig message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns DanmuPlayerConfig
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.DanmuPlayerConfig;

                        /**
                         * Creates a plain object from a DanmuPlayerConfig message. Also converts values to other types if specified.
                         * @param message DanmuPlayerConfig
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.DanmuPlayerConfig, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this DanmuPlayerConfig to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for DanmuPlayerConfig
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace DanmuPlayerConfig {

                        /** Properties of a DanmuPlayerConfig. */
                        interface $Properties {

                            /** DanmuPlayerConfig playerDanmakuSwitch */
                            playerDanmakuSwitch?: (boolean|null);

                            /** DanmuPlayerConfig playerDanmakuSwitchSave */
                            playerDanmakuSwitchSave?: (boolean|null);

                            /** DanmuPlayerConfig playerDanmakuUseDefaultConfig */
                            playerDanmakuUseDefaultConfig?: (boolean|null);

                            /** DanmuPlayerConfig playerDanmakuAiRecommendedSwitch */
                            playerDanmakuAiRecommendedSwitch?: (boolean|null);

                            /** DanmuPlayerConfig playerDanmakuAiRecommendedLevel */
                            playerDanmakuAiRecommendedLevel?: (number|null);

                            /** DanmuPlayerConfig playerDanmakuBlocktop */
                            playerDanmakuBlocktop?: (boolean|null);

                            /** DanmuPlayerConfig playerDanmakuBlockscroll */
                            playerDanmakuBlockscroll?: (boolean|null);

                            /** DanmuPlayerConfig playerDanmakuBlockbottom */
                            playerDanmakuBlockbottom?: (boolean|null);

                            /** DanmuPlayerConfig playerDanmakuBlockcolorful */
                            playerDanmakuBlockcolorful?: (boolean|null);

                            /** DanmuPlayerConfig playerDanmakuBlockrepeat */
                            playerDanmakuBlockrepeat?: (boolean|null);

                            /** DanmuPlayerConfig playerDanmakuBlockspecial */
                            playerDanmakuBlockspecial?: (boolean|null);

                            /** DanmuPlayerConfig playerDanmakuOpacity */
                            playerDanmakuOpacity?: (number|null);

                            /** DanmuPlayerConfig playerDanmakuScalingfactor */
                            playerDanmakuScalingfactor?: (number|null);

                            /** DanmuPlayerConfig playerDanmakuDomain */
                            playerDanmakuDomain?: (number|null);

                            /** DanmuPlayerConfig playerDanmakuSpeed */
                            playerDanmakuSpeed?: (number|null);

                            /** DanmuPlayerConfig playerDanmakuEnableblocklist */
                            playerDanmakuEnableblocklist?: (boolean|null);

                            /** DanmuPlayerConfig inlinePlayerDanmakuSwitch */
                            inlinePlayerDanmakuSwitch?: (boolean|null);

                            /** DanmuPlayerConfig inlinePlayerDanmakuConfig */
                            inlinePlayerDanmakuConfig?: (number|null);

                            /** DanmuPlayerConfig playerDanmakuIosSwitchSave */
                            playerDanmakuIosSwitchSave?: (number|null);

                            /** DanmuPlayerConfig playerDanmakuSeniorModeSwitch */
                            playerDanmakuSeniorModeSwitch?: (number|null);

                            /** DanmuPlayerConfig playerDanmakuAiRecommendedLevelV2 */
                            playerDanmakuAiRecommendedLevelV2?: (number|null);

                            /** DanmuPlayerConfig playerDanmakuAiRecommendedLevelV2Map */
                            playerDanmakuAiRecommendedLevelV2Map?: ({ [k: string]: number }|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of a DanmuPlayerConfig. */
                        type $Shape = bilibili.community.service.dm.v1.DanmuPlayerConfig.$Properties;
                    }

                    /**
                     * Properties of a DanmuPlayerConfigPanel.
                     * @deprecated Use bilibili.community.service.dm.v1.DanmuPlayerConfigPanel.$Properties instead.
                     */
                    interface IDanmuPlayerConfigPanel extends bilibili.community.service.dm.v1.DanmuPlayerConfigPanel.$Properties {
                    }

                    /** Represents a DanmuPlayerConfigPanel. */
                    class DanmuPlayerConfigPanel {

                        /**
                         * Constructs a new DanmuPlayerConfigPanel.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.DanmuPlayerConfigPanel.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** DanmuPlayerConfigPanel selectionText. */
                        selectionText: string;

                        /**
                         * Creates a new DanmuPlayerConfigPanel instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns DanmuPlayerConfigPanel instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.DanmuPlayerConfigPanel.$Shape): bilibili.community.service.dm.v1.DanmuPlayerConfigPanel & bilibili.community.service.dm.v1.DanmuPlayerConfigPanel.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.DanmuPlayerConfigPanel.$Properties): bilibili.community.service.dm.v1.DanmuPlayerConfigPanel;

                        /**
                         * Encodes the specified DanmuPlayerConfigPanel message. Does not implicitly {@link bilibili.community.service.dm.v1.DanmuPlayerConfigPanel.verify|verify} messages.
                         * @param message DanmuPlayerConfigPanel message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.DanmuPlayerConfigPanel.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified DanmuPlayerConfigPanel message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.DanmuPlayerConfigPanel.verify|verify} messages.
                         * @param message DanmuPlayerConfigPanel message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.DanmuPlayerConfigPanel.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a DanmuPlayerConfigPanel message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.DanmuPlayerConfigPanel & bilibili.community.service.dm.v1.DanmuPlayerConfigPanel.$Shape} DanmuPlayerConfigPanel
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.DanmuPlayerConfigPanel & bilibili.community.service.dm.v1.DanmuPlayerConfigPanel.$Shape;

                        /**
                         * Decodes a DanmuPlayerConfigPanel message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.DanmuPlayerConfigPanel & bilibili.community.service.dm.v1.DanmuPlayerConfigPanel.$Shape} DanmuPlayerConfigPanel
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.DanmuPlayerConfigPanel & bilibili.community.service.dm.v1.DanmuPlayerConfigPanel.$Shape;

                        /**
                         * Verifies a DanmuPlayerConfigPanel message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a DanmuPlayerConfigPanel message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns DanmuPlayerConfigPanel
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.DanmuPlayerConfigPanel;

                        /**
                         * Creates a plain object from a DanmuPlayerConfigPanel message. Also converts values to other types if specified.
                         * @param message DanmuPlayerConfigPanel
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.DanmuPlayerConfigPanel, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this DanmuPlayerConfigPanel to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for DanmuPlayerConfigPanel
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace DanmuPlayerConfigPanel {

                        /** Properties of a DanmuPlayerConfigPanel. */
                        interface $Properties {

                            /** DanmuPlayerConfigPanel selectionText */
                            selectionText?: (string|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of a DanmuPlayerConfigPanel. */
                        type $Shape = bilibili.community.service.dm.v1.DanmuPlayerConfigPanel.$Properties;
                    }

                    /**
                     * Properties of a DanmuPlayerDynamicConfig.
                     * @deprecated Use bilibili.community.service.dm.v1.DanmuPlayerDynamicConfig.$Properties instead.
                     */
                    interface IDanmuPlayerDynamicConfig extends bilibili.community.service.dm.v1.DanmuPlayerDynamicConfig.$Properties {
                    }

                    /** Represents a DanmuPlayerDynamicConfig. */
                    class DanmuPlayerDynamicConfig {

                        /**
                         * Constructs a new DanmuPlayerDynamicConfig.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.DanmuPlayerDynamicConfig.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** DanmuPlayerDynamicConfig progress. */
                        progress: number;

                        /** DanmuPlayerDynamicConfig playerDanmakuDomain. */
                        playerDanmakuDomain: number;

                        /**
                         * Creates a new DanmuPlayerDynamicConfig instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns DanmuPlayerDynamicConfig instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.DanmuPlayerDynamicConfig.$Shape): bilibili.community.service.dm.v1.DanmuPlayerDynamicConfig & bilibili.community.service.dm.v1.DanmuPlayerDynamicConfig.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.DanmuPlayerDynamicConfig.$Properties): bilibili.community.service.dm.v1.DanmuPlayerDynamicConfig;

                        /**
                         * Encodes the specified DanmuPlayerDynamicConfig message. Does not implicitly {@link bilibili.community.service.dm.v1.DanmuPlayerDynamicConfig.verify|verify} messages.
                         * @param message DanmuPlayerDynamicConfig message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.DanmuPlayerDynamicConfig.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified DanmuPlayerDynamicConfig message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.DanmuPlayerDynamicConfig.verify|verify} messages.
                         * @param message DanmuPlayerDynamicConfig message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.DanmuPlayerDynamicConfig.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a DanmuPlayerDynamicConfig message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.DanmuPlayerDynamicConfig & bilibili.community.service.dm.v1.DanmuPlayerDynamicConfig.$Shape} DanmuPlayerDynamicConfig
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.DanmuPlayerDynamicConfig & bilibili.community.service.dm.v1.DanmuPlayerDynamicConfig.$Shape;

                        /**
                         * Decodes a DanmuPlayerDynamicConfig message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.DanmuPlayerDynamicConfig & bilibili.community.service.dm.v1.DanmuPlayerDynamicConfig.$Shape} DanmuPlayerDynamicConfig
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.DanmuPlayerDynamicConfig & bilibili.community.service.dm.v1.DanmuPlayerDynamicConfig.$Shape;

                        /**
                         * Verifies a DanmuPlayerDynamicConfig message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a DanmuPlayerDynamicConfig message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns DanmuPlayerDynamicConfig
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.DanmuPlayerDynamicConfig;

                        /**
                         * Creates a plain object from a DanmuPlayerDynamicConfig message. Also converts values to other types if specified.
                         * @param message DanmuPlayerDynamicConfig
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.DanmuPlayerDynamicConfig, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this DanmuPlayerDynamicConfig to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for DanmuPlayerDynamicConfig
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace DanmuPlayerDynamicConfig {

                        /** Properties of a DanmuPlayerDynamicConfig. */
                        interface $Properties {

                            /** DanmuPlayerDynamicConfig progress */
                            progress?: (number|null);

                            /** DanmuPlayerDynamicConfig playerDanmakuDomain */
                            playerDanmakuDomain?: (number|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of a DanmuPlayerDynamicConfig. */
                        type $Shape = bilibili.community.service.dm.v1.DanmuPlayerDynamicConfig.$Properties;
                    }

                    /**
                     * Properties of a DanmuPlayerViewConfig.
                     * @deprecated Use bilibili.community.service.dm.v1.DanmuPlayerViewConfig.$Properties instead.
                     */
                    interface IDanmuPlayerViewConfig extends bilibili.community.service.dm.v1.DanmuPlayerViewConfig.$Properties {
                    }

                    /** Represents a DanmuPlayerViewConfig. */
                    class DanmuPlayerViewConfig {

                        /**
                         * Constructs a new DanmuPlayerViewConfig.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.DanmuPlayerViewConfig.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** DanmuPlayerViewConfig danmukuDefaultPlayerConfig. */
                        danmukuDefaultPlayerConfig?: (bilibili.community.service.dm.v1.DanmuDefaultPlayerConfig.$Properties|null);

                        /** DanmuPlayerViewConfig danmukuPlayerConfig. */
                        danmukuPlayerConfig?: (bilibili.community.service.dm.v1.DanmuPlayerConfig.$Properties|null);

                        /** DanmuPlayerViewConfig danmukuPlayerDynamicConfig. */
                        danmukuPlayerDynamicConfig: bilibili.community.service.dm.v1.DanmuPlayerDynamicConfig.$Properties[];

                        /** DanmuPlayerViewConfig danmukuPlayerConfigPanel. */
                        danmukuPlayerConfigPanel?: (bilibili.community.service.dm.v1.DanmuPlayerConfigPanel.$Properties|null);

                        /**
                         * Creates a new DanmuPlayerViewConfig instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns DanmuPlayerViewConfig instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.DanmuPlayerViewConfig.$Shape): bilibili.community.service.dm.v1.DanmuPlayerViewConfig & bilibili.community.service.dm.v1.DanmuPlayerViewConfig.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.DanmuPlayerViewConfig.$Properties): bilibili.community.service.dm.v1.DanmuPlayerViewConfig;

                        /**
                         * Encodes the specified DanmuPlayerViewConfig message. Does not implicitly {@link bilibili.community.service.dm.v1.DanmuPlayerViewConfig.verify|verify} messages.
                         * @param message DanmuPlayerViewConfig message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.DanmuPlayerViewConfig.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified DanmuPlayerViewConfig message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.DanmuPlayerViewConfig.verify|verify} messages.
                         * @param message DanmuPlayerViewConfig message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.DanmuPlayerViewConfig.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a DanmuPlayerViewConfig message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.DanmuPlayerViewConfig & bilibili.community.service.dm.v1.DanmuPlayerViewConfig.$Shape} DanmuPlayerViewConfig
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.DanmuPlayerViewConfig & bilibili.community.service.dm.v1.DanmuPlayerViewConfig.$Shape;

                        /**
                         * Decodes a DanmuPlayerViewConfig message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.DanmuPlayerViewConfig & bilibili.community.service.dm.v1.DanmuPlayerViewConfig.$Shape} DanmuPlayerViewConfig
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.DanmuPlayerViewConfig & bilibili.community.service.dm.v1.DanmuPlayerViewConfig.$Shape;

                        /**
                         * Verifies a DanmuPlayerViewConfig message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a DanmuPlayerViewConfig message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns DanmuPlayerViewConfig
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.DanmuPlayerViewConfig;

                        /**
                         * Creates a plain object from a DanmuPlayerViewConfig message. Also converts values to other types if specified.
                         * @param message DanmuPlayerViewConfig
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.DanmuPlayerViewConfig, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this DanmuPlayerViewConfig to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for DanmuPlayerViewConfig
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace DanmuPlayerViewConfig {

                        /** Properties of a DanmuPlayerViewConfig. */
                        interface $Properties {

                            /** DanmuPlayerViewConfig danmukuDefaultPlayerConfig */
                            danmukuDefaultPlayerConfig?: (bilibili.community.service.dm.v1.DanmuDefaultPlayerConfig.$Properties|null);

                            /** DanmuPlayerViewConfig danmukuPlayerConfig */
                            danmukuPlayerConfig?: (bilibili.community.service.dm.v1.DanmuPlayerConfig.$Properties|null);

                            /** DanmuPlayerViewConfig danmukuPlayerDynamicConfig */
                            danmukuPlayerDynamicConfig?: (bilibili.community.service.dm.v1.DanmuPlayerDynamicConfig.$Properties[]|null);

                            /** DanmuPlayerViewConfig danmukuPlayerConfigPanel */
                            danmukuPlayerConfigPanel?: (bilibili.community.service.dm.v1.DanmuPlayerConfigPanel.$Properties|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of a DanmuPlayerViewConfig. */
                        type $Shape = bilibili.community.service.dm.v1.DanmuPlayerViewConfig.$Properties;
                    }

                    /**
                     * Properties of a DanmuWebPlayerConfig.
                     * @deprecated Use bilibili.community.service.dm.v1.DanmuWebPlayerConfig.$Properties instead.
                     */
                    interface IDanmuWebPlayerConfig extends bilibili.community.service.dm.v1.DanmuWebPlayerConfig.$Properties {
                    }

                    /** Represents a DanmuWebPlayerConfig. */
                    class DanmuWebPlayerConfig {

                        /**
                         * Constructs a new DanmuWebPlayerConfig.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.DanmuWebPlayerConfig.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** DanmuWebPlayerConfig dmSwitch. */
                        dmSwitch: boolean;

                        /** DanmuWebPlayerConfig aiSwitch. */
                        aiSwitch: boolean;

                        /** DanmuWebPlayerConfig aiLevel. */
                        aiLevel: number;

                        /** DanmuWebPlayerConfig blocktop. */
                        blocktop: boolean;

                        /** DanmuWebPlayerConfig blockscroll. */
                        blockscroll: boolean;

                        /** DanmuWebPlayerConfig blockbottom. */
                        blockbottom: boolean;

                        /** DanmuWebPlayerConfig blockcolor. */
                        blockcolor: boolean;

                        /** DanmuWebPlayerConfig blockspecial. */
                        blockspecial: boolean;

                        /** DanmuWebPlayerConfig preventshade. */
                        preventshade: boolean;

                        /** DanmuWebPlayerConfig dmask. */
                        dmask: boolean;

                        /** DanmuWebPlayerConfig opacity. */
                        opacity: number;

                        /** DanmuWebPlayerConfig dmarea. */
                        dmarea: number;

                        /** DanmuWebPlayerConfig speedplus. */
                        speedplus: number;

                        /** DanmuWebPlayerConfig fontsize. */
                        fontsize: number;

                        /** DanmuWebPlayerConfig screensync. */
                        screensync: boolean;

                        /** DanmuWebPlayerConfig speedsync. */
                        speedsync: boolean;

                        /** DanmuWebPlayerConfig fontfamily. */
                        fontfamily: string;

                        /** DanmuWebPlayerConfig bold. */
                        bold: boolean;

                        /** DanmuWebPlayerConfig fontborder. */
                        fontborder: number;

                        /** DanmuWebPlayerConfig drawType. */
                        drawType: string;

                        /** DanmuWebPlayerConfig seniorModeSwitch. */
                        seniorModeSwitch: number;

                        /** DanmuWebPlayerConfig aiLevelV2. */
                        aiLevelV2: number;

                        /** DanmuWebPlayerConfig aiLevelV2Map. */
                        aiLevelV2Map: { [k: string]: number };

                        /**
                         * Creates a new DanmuWebPlayerConfig instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns DanmuWebPlayerConfig instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.DanmuWebPlayerConfig.$Shape): bilibili.community.service.dm.v1.DanmuWebPlayerConfig & bilibili.community.service.dm.v1.DanmuWebPlayerConfig.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.DanmuWebPlayerConfig.$Properties): bilibili.community.service.dm.v1.DanmuWebPlayerConfig;

                        /**
                         * Encodes the specified DanmuWebPlayerConfig message. Does not implicitly {@link bilibili.community.service.dm.v1.DanmuWebPlayerConfig.verify|verify} messages.
                         * @param message DanmuWebPlayerConfig message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.DanmuWebPlayerConfig.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified DanmuWebPlayerConfig message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.DanmuWebPlayerConfig.verify|verify} messages.
                         * @param message DanmuWebPlayerConfig message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.DanmuWebPlayerConfig.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a DanmuWebPlayerConfig message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.DanmuWebPlayerConfig & bilibili.community.service.dm.v1.DanmuWebPlayerConfig.$Shape} DanmuWebPlayerConfig
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.DanmuWebPlayerConfig & bilibili.community.service.dm.v1.DanmuWebPlayerConfig.$Shape;

                        /**
                         * Decodes a DanmuWebPlayerConfig message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.DanmuWebPlayerConfig & bilibili.community.service.dm.v1.DanmuWebPlayerConfig.$Shape} DanmuWebPlayerConfig
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.DanmuWebPlayerConfig & bilibili.community.service.dm.v1.DanmuWebPlayerConfig.$Shape;

                        /**
                         * Verifies a DanmuWebPlayerConfig message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a DanmuWebPlayerConfig message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns DanmuWebPlayerConfig
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.DanmuWebPlayerConfig;

                        /**
                         * Creates a plain object from a DanmuWebPlayerConfig message. Also converts values to other types if specified.
                         * @param message DanmuWebPlayerConfig
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.DanmuWebPlayerConfig, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this DanmuWebPlayerConfig to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for DanmuWebPlayerConfig
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace DanmuWebPlayerConfig {

                        /** Properties of a DanmuWebPlayerConfig. */
                        interface $Properties {

                            /** DanmuWebPlayerConfig dmSwitch */
                            dmSwitch?: (boolean|null);

                            /** DanmuWebPlayerConfig aiSwitch */
                            aiSwitch?: (boolean|null);

                            /** DanmuWebPlayerConfig aiLevel */
                            aiLevel?: (number|null);

                            /** DanmuWebPlayerConfig blocktop */
                            blocktop?: (boolean|null);

                            /** DanmuWebPlayerConfig blockscroll */
                            blockscroll?: (boolean|null);

                            /** DanmuWebPlayerConfig blockbottom */
                            blockbottom?: (boolean|null);

                            /** DanmuWebPlayerConfig blockcolor */
                            blockcolor?: (boolean|null);

                            /** DanmuWebPlayerConfig blockspecial */
                            blockspecial?: (boolean|null);

                            /** DanmuWebPlayerConfig preventshade */
                            preventshade?: (boolean|null);

                            /** DanmuWebPlayerConfig dmask */
                            dmask?: (boolean|null);

                            /** DanmuWebPlayerConfig opacity */
                            opacity?: (number|null);

                            /** DanmuWebPlayerConfig dmarea */
                            dmarea?: (number|null);

                            /** DanmuWebPlayerConfig speedplus */
                            speedplus?: (number|null);

                            /** DanmuWebPlayerConfig fontsize */
                            fontsize?: (number|null);

                            /** DanmuWebPlayerConfig screensync */
                            screensync?: (boolean|null);

                            /** DanmuWebPlayerConfig speedsync */
                            speedsync?: (boolean|null);

                            /** DanmuWebPlayerConfig fontfamily */
                            fontfamily?: (string|null);

                            /** DanmuWebPlayerConfig bold */
                            bold?: (boolean|null);

                            /** DanmuWebPlayerConfig fontborder */
                            fontborder?: (number|null);

                            /** DanmuWebPlayerConfig drawType */
                            drawType?: (string|null);

                            /** DanmuWebPlayerConfig seniorModeSwitch */
                            seniorModeSwitch?: (number|null);

                            /** DanmuWebPlayerConfig aiLevelV2 */
                            aiLevelV2?: (number|null);

                            /** DanmuWebPlayerConfig aiLevelV2Map */
                            aiLevelV2Map?: ({ [k: string]: number }|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of a DanmuWebPlayerConfig. */
                        type $Shape = bilibili.community.service.dm.v1.DanmuWebPlayerConfig.$Properties;
                    }

                    /** DMAttrBit enum. */
                    enum DMAttrBit {

                        /** DMAttrBitProtect value */
                        DMAttrBitProtect = 0,

                        /** DMAttrBitFromLive value */
                        DMAttrBitFromLive = 1,

                        /** DMAttrHighLike value */
                        DMAttrHighLike = 2
                    }

                    /**
                     * Properties of a DmColorful.
                     * @deprecated Use bilibili.community.service.dm.v1.DmColorful.$Properties instead.
                     */
                    interface IDmColorful extends bilibili.community.service.dm.v1.DmColorful.$Properties {
                    }

                    /** Represents a DmColorful. */
                    class DmColorful {

                        /**
                         * Constructs a new DmColorful.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.DmColorful.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** DmColorful type. */
                        type: bilibili.community.service.dm.v1.DmColorfulType;

                        /** DmColorful src. */
                        src: string;

                        /**
                         * Creates a new DmColorful instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns DmColorful instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.DmColorful.$Shape): bilibili.community.service.dm.v1.DmColorful & bilibili.community.service.dm.v1.DmColorful.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.DmColorful.$Properties): bilibili.community.service.dm.v1.DmColorful;

                        /**
                         * Encodes the specified DmColorful message. Does not implicitly {@link bilibili.community.service.dm.v1.DmColorful.verify|verify} messages.
                         * @param message DmColorful message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.DmColorful.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified DmColorful message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.DmColorful.verify|verify} messages.
                         * @param message DmColorful message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.DmColorful.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a DmColorful message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.DmColorful & bilibili.community.service.dm.v1.DmColorful.$Shape} DmColorful
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.DmColorful & bilibili.community.service.dm.v1.DmColorful.$Shape;

                        /**
                         * Decodes a DmColorful message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.DmColorful & bilibili.community.service.dm.v1.DmColorful.$Shape} DmColorful
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.DmColorful & bilibili.community.service.dm.v1.DmColorful.$Shape;

                        /**
                         * Verifies a DmColorful message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a DmColorful message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns DmColorful
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.DmColorful;

                        /**
                         * Creates a plain object from a DmColorful message. Also converts values to other types if specified.
                         * @param message DmColorful
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.DmColorful, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this DmColorful to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for DmColorful
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace DmColorful {

                        /** Properties of a DmColorful. */
                        interface $Properties {

                            /** DmColorful type */
                            type?: (bilibili.community.service.dm.v1.DmColorfulType|null);

                            /** DmColorful src */
                            src?: (string|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of a DmColorful. */
                        type $Shape = bilibili.community.service.dm.v1.DmColorful.$Properties;
                    }

                    /** DmColorfulType enum. */
                    enum DmColorfulType {

                        /** NoneType value */
                        NoneType = 0,

                        /** VipGradualColor value */
                        VipGradualColor = 60001
                    }

                    /**
                     * Properties of a DmExpoReportReq.
                     * @deprecated Use bilibili.community.service.dm.v1.DmExpoReportReq.$Properties instead.
                     */
                    interface IDmExpoReportReq extends bilibili.community.service.dm.v1.DmExpoReportReq.$Properties {
                    }

                    /** Represents a DmExpoReportReq. */
                    class DmExpoReportReq {

                        /**
                         * Constructs a new DmExpoReportReq.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.DmExpoReportReq.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** DmExpoReportReq sessionId. */
                        sessionId: string;

                        /** DmExpoReportReq oid. */
                        oid: (number|Long);

                        /** DmExpoReportReq spmid. */
                        spmid: string;

                        /**
                         * Creates a new DmExpoReportReq instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns DmExpoReportReq instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.DmExpoReportReq.$Shape): bilibili.community.service.dm.v1.DmExpoReportReq & bilibili.community.service.dm.v1.DmExpoReportReq.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.DmExpoReportReq.$Properties): bilibili.community.service.dm.v1.DmExpoReportReq;

                        /**
                         * Encodes the specified DmExpoReportReq message. Does not implicitly {@link bilibili.community.service.dm.v1.DmExpoReportReq.verify|verify} messages.
                         * @param message DmExpoReportReq message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.DmExpoReportReq.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified DmExpoReportReq message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.DmExpoReportReq.verify|verify} messages.
                         * @param message DmExpoReportReq message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.DmExpoReportReq.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a DmExpoReportReq message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.DmExpoReportReq & bilibili.community.service.dm.v1.DmExpoReportReq.$Shape} DmExpoReportReq
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.DmExpoReportReq & bilibili.community.service.dm.v1.DmExpoReportReq.$Shape;

                        /**
                         * Decodes a DmExpoReportReq message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.DmExpoReportReq & bilibili.community.service.dm.v1.DmExpoReportReq.$Shape} DmExpoReportReq
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.DmExpoReportReq & bilibili.community.service.dm.v1.DmExpoReportReq.$Shape;

                        /**
                         * Verifies a DmExpoReportReq message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a DmExpoReportReq message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns DmExpoReportReq
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.DmExpoReportReq;

                        /**
                         * Creates a plain object from a DmExpoReportReq message. Also converts values to other types if specified.
                         * @param message DmExpoReportReq
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.DmExpoReportReq, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this DmExpoReportReq to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for DmExpoReportReq
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace DmExpoReportReq {

                        /** Properties of a DmExpoReportReq. */
                        interface $Properties {

                            /** DmExpoReportReq sessionId */
                            sessionId?: (string|null);

                            /** DmExpoReportReq oid */
                            oid?: (number|Long|null);

                            /** DmExpoReportReq spmid */
                            spmid?: (string|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of a DmExpoReportReq. */
                        type $Shape = bilibili.community.service.dm.v1.DmExpoReportReq.$Properties;
                    }

                    /**
                     * Properties of a DmExpoReportRes.
                     * @deprecated Use bilibili.community.service.dm.v1.DmExpoReportRes.$Properties instead.
                     */
                    interface IDmExpoReportRes extends bilibili.community.service.dm.v1.DmExpoReportRes.$Properties {
                    }

                    /** Represents a DmExpoReportRes. */
                    class DmExpoReportRes {

                        /**
                         * Constructs a new DmExpoReportRes.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.DmExpoReportRes.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /**
                         * Creates a new DmExpoReportRes instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns DmExpoReportRes instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.DmExpoReportRes.$Shape): bilibili.community.service.dm.v1.DmExpoReportRes & bilibili.community.service.dm.v1.DmExpoReportRes.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.DmExpoReportRes.$Properties): bilibili.community.service.dm.v1.DmExpoReportRes;

                        /**
                         * Encodes the specified DmExpoReportRes message. Does not implicitly {@link bilibili.community.service.dm.v1.DmExpoReportRes.verify|verify} messages.
                         * @param message DmExpoReportRes message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.DmExpoReportRes.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified DmExpoReportRes message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.DmExpoReportRes.verify|verify} messages.
                         * @param message DmExpoReportRes message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.DmExpoReportRes.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a DmExpoReportRes message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.DmExpoReportRes & bilibili.community.service.dm.v1.DmExpoReportRes.$Shape} DmExpoReportRes
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.DmExpoReportRes & bilibili.community.service.dm.v1.DmExpoReportRes.$Shape;

                        /**
                         * Decodes a DmExpoReportRes message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.DmExpoReportRes & bilibili.community.service.dm.v1.DmExpoReportRes.$Shape} DmExpoReportRes
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.DmExpoReportRes & bilibili.community.service.dm.v1.DmExpoReportRes.$Shape;

                        /**
                         * Verifies a DmExpoReportRes message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a DmExpoReportRes message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns DmExpoReportRes
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.DmExpoReportRes;

                        /**
                         * Creates a plain object from a DmExpoReportRes message. Also converts values to other types if specified.
                         * @param message DmExpoReportRes
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.DmExpoReportRes, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this DmExpoReportRes to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for DmExpoReportRes
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace DmExpoReportRes {

                        /** Properties of a DmExpoReportRes. */
                        interface $Properties {

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of a DmExpoReportRes. */
                        type $Shape = bilibili.community.service.dm.v1.DmExpoReportRes.$Properties;
                    }

                    /**
                     * Properties of a DmPlayerConfigReq.
                     * @deprecated Use bilibili.community.service.dm.v1.DmPlayerConfigReq.$Properties instead.
                     */
                    interface IDmPlayerConfigReq extends bilibili.community.service.dm.v1.DmPlayerConfigReq.$Properties {
                    }

                    /** Represents a DmPlayerConfigReq. */
                    class DmPlayerConfigReq {

                        /**
                         * Constructs a new DmPlayerConfigReq.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.DmPlayerConfigReq.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** DmPlayerConfigReq ts. */
                        ts: (number|Long);

                        /** DmPlayerConfigReq switch. */
                        switch?: (bilibili.community.service.dm.v1.PlayerDanmakuSwitch.$Properties|null);

                        /** DmPlayerConfigReq switchSave. */
                        switchSave?: (bilibili.community.service.dm.v1.PlayerDanmakuSwitchSave.$Properties|null);

                        /** DmPlayerConfigReq useDefaultConfig. */
                        useDefaultConfig?: (bilibili.community.service.dm.v1.PlayerDanmakuUseDefaultConfig.$Properties|null);

                        /** DmPlayerConfigReq aiRecommendedSwitch. */
                        aiRecommendedSwitch?: (bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedSwitch.$Properties|null);

                        /** DmPlayerConfigReq aiRecommendedLevel. */
                        aiRecommendedLevel?: (bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedLevel.$Properties|null);

                        /** DmPlayerConfigReq blocktop. */
                        blocktop?: (bilibili.community.service.dm.v1.PlayerDanmakuBlocktop.$Properties|null);

                        /** DmPlayerConfigReq blockscroll. */
                        blockscroll?: (bilibili.community.service.dm.v1.PlayerDanmakuBlockscroll.$Properties|null);

                        /** DmPlayerConfigReq blockbottom. */
                        blockbottom?: (bilibili.community.service.dm.v1.PlayerDanmakuBlockbottom.$Properties|null);

                        /** DmPlayerConfigReq blockcolorful. */
                        blockcolorful?: (bilibili.community.service.dm.v1.PlayerDanmakuBlockcolorful.$Properties|null);

                        /** DmPlayerConfigReq blockrepeat. */
                        blockrepeat?: (bilibili.community.service.dm.v1.PlayerDanmakuBlockrepeat.$Properties|null);

                        /** DmPlayerConfigReq blockspecial. */
                        blockspecial?: (bilibili.community.service.dm.v1.PlayerDanmakuBlockspecial.$Properties|null);

                        /** DmPlayerConfigReq opacity. */
                        opacity?: (bilibili.community.service.dm.v1.PlayerDanmakuOpacity.$Properties|null);

                        /** DmPlayerConfigReq scalingfactor. */
                        scalingfactor?: (bilibili.community.service.dm.v1.PlayerDanmakuScalingfactor.$Properties|null);

                        /** DmPlayerConfigReq domain. */
                        domain?: (bilibili.community.service.dm.v1.PlayerDanmakuDomain.$Properties|null);

                        /** DmPlayerConfigReq speed. */
                        speed?: (bilibili.community.service.dm.v1.PlayerDanmakuSpeed.$Properties|null);

                        /** DmPlayerConfigReq enableblocklist. */
                        enableblocklist?: (bilibili.community.service.dm.v1.PlayerDanmakuEnableblocklist.$Properties|null);

                        /** DmPlayerConfigReq inlinePlayerDanmakuSwitch. */
                        inlinePlayerDanmakuSwitch?: (bilibili.community.service.dm.v1.InlinePlayerDanmakuSwitch.$Properties|null);

                        /** DmPlayerConfigReq seniorModeSwitch. */
                        seniorModeSwitch?: (bilibili.community.service.dm.v1.PlayerDanmakuSeniorModeSwitch.$Properties|null);

                        /** DmPlayerConfigReq aiRecommendedLevelV2. */
                        aiRecommendedLevelV2?: (bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedLevelV2.$Properties|null);

                        /**
                         * Creates a new DmPlayerConfigReq instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns DmPlayerConfigReq instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.DmPlayerConfigReq.$Shape): bilibili.community.service.dm.v1.DmPlayerConfigReq & bilibili.community.service.dm.v1.DmPlayerConfigReq.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.DmPlayerConfigReq.$Properties): bilibili.community.service.dm.v1.DmPlayerConfigReq;

                        /**
                         * Encodes the specified DmPlayerConfigReq message. Does not implicitly {@link bilibili.community.service.dm.v1.DmPlayerConfigReq.verify|verify} messages.
                         * @param message DmPlayerConfigReq message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.DmPlayerConfigReq.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified DmPlayerConfigReq message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.DmPlayerConfigReq.verify|verify} messages.
                         * @param message DmPlayerConfigReq message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.DmPlayerConfigReq.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a DmPlayerConfigReq message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.DmPlayerConfigReq & bilibili.community.service.dm.v1.DmPlayerConfigReq.$Shape} DmPlayerConfigReq
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.DmPlayerConfigReq & bilibili.community.service.dm.v1.DmPlayerConfigReq.$Shape;

                        /**
                         * Decodes a DmPlayerConfigReq message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.DmPlayerConfigReq & bilibili.community.service.dm.v1.DmPlayerConfigReq.$Shape} DmPlayerConfigReq
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.DmPlayerConfigReq & bilibili.community.service.dm.v1.DmPlayerConfigReq.$Shape;

                        /**
                         * Verifies a DmPlayerConfigReq message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a DmPlayerConfigReq message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns DmPlayerConfigReq
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.DmPlayerConfigReq;

                        /**
                         * Creates a plain object from a DmPlayerConfigReq message. Also converts values to other types if specified.
                         * @param message DmPlayerConfigReq
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.DmPlayerConfigReq, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this DmPlayerConfigReq to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for DmPlayerConfigReq
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace DmPlayerConfigReq {

                        /** Properties of a DmPlayerConfigReq. */
                        interface $Properties {

                            /** DmPlayerConfigReq ts */
                            ts?: (number|Long|null);

                            /** DmPlayerConfigReq switch */
                            "switch"?: (bilibili.community.service.dm.v1.PlayerDanmakuSwitch.$Properties|null);

                            /** DmPlayerConfigReq switchSave */
                            switchSave?: (bilibili.community.service.dm.v1.PlayerDanmakuSwitchSave.$Properties|null);

                            /** DmPlayerConfigReq useDefaultConfig */
                            useDefaultConfig?: (bilibili.community.service.dm.v1.PlayerDanmakuUseDefaultConfig.$Properties|null);

                            /** DmPlayerConfigReq aiRecommendedSwitch */
                            aiRecommendedSwitch?: (bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedSwitch.$Properties|null);

                            /** DmPlayerConfigReq aiRecommendedLevel */
                            aiRecommendedLevel?: (bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedLevel.$Properties|null);

                            /** DmPlayerConfigReq blocktop */
                            blocktop?: (bilibili.community.service.dm.v1.PlayerDanmakuBlocktop.$Properties|null);

                            /** DmPlayerConfigReq blockscroll */
                            blockscroll?: (bilibili.community.service.dm.v1.PlayerDanmakuBlockscroll.$Properties|null);

                            /** DmPlayerConfigReq blockbottom */
                            blockbottom?: (bilibili.community.service.dm.v1.PlayerDanmakuBlockbottom.$Properties|null);

                            /** DmPlayerConfigReq blockcolorful */
                            blockcolorful?: (bilibili.community.service.dm.v1.PlayerDanmakuBlockcolorful.$Properties|null);

                            /** DmPlayerConfigReq blockrepeat */
                            blockrepeat?: (bilibili.community.service.dm.v1.PlayerDanmakuBlockrepeat.$Properties|null);

                            /** DmPlayerConfigReq blockspecial */
                            blockspecial?: (bilibili.community.service.dm.v1.PlayerDanmakuBlockspecial.$Properties|null);

                            /** DmPlayerConfigReq opacity */
                            opacity?: (bilibili.community.service.dm.v1.PlayerDanmakuOpacity.$Properties|null);

                            /** DmPlayerConfigReq scalingfactor */
                            scalingfactor?: (bilibili.community.service.dm.v1.PlayerDanmakuScalingfactor.$Properties|null);

                            /** DmPlayerConfigReq domain */
                            domain?: (bilibili.community.service.dm.v1.PlayerDanmakuDomain.$Properties|null);

                            /** DmPlayerConfigReq speed */
                            speed?: (bilibili.community.service.dm.v1.PlayerDanmakuSpeed.$Properties|null);

                            /** DmPlayerConfigReq enableblocklist */
                            enableblocklist?: (bilibili.community.service.dm.v1.PlayerDanmakuEnableblocklist.$Properties|null);

                            /** DmPlayerConfigReq inlinePlayerDanmakuSwitch */
                            inlinePlayerDanmakuSwitch?: (bilibili.community.service.dm.v1.InlinePlayerDanmakuSwitch.$Properties|null);

                            /** DmPlayerConfigReq seniorModeSwitch */
                            seniorModeSwitch?: (bilibili.community.service.dm.v1.PlayerDanmakuSeniorModeSwitch.$Properties|null);

                            /** DmPlayerConfigReq aiRecommendedLevelV2 */
                            aiRecommendedLevelV2?: (bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedLevelV2.$Properties|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of a DmPlayerConfigReq. */
                        type $Shape = bilibili.community.service.dm.v1.DmPlayerConfigReq.$Properties;
                    }

                    /**
                     * Properties of a DmSegConfig.
                     * @deprecated Use bilibili.community.service.dm.v1.DmSegConfig.$Properties instead.
                     */
                    interface IDmSegConfig extends bilibili.community.service.dm.v1.DmSegConfig.$Properties {
                    }

                    /** Represents a DmSegConfig. */
                    class DmSegConfig {

                        /**
                         * Constructs a new DmSegConfig.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.DmSegConfig.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** DmSegConfig pageSize. */
                        pageSize: (number|Long);

                        /** DmSegConfig total. */
                        total: (number|Long);

                        /**
                         * Creates a new DmSegConfig instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns DmSegConfig instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.DmSegConfig.$Shape): bilibili.community.service.dm.v1.DmSegConfig & bilibili.community.service.dm.v1.DmSegConfig.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.DmSegConfig.$Properties): bilibili.community.service.dm.v1.DmSegConfig;

                        /**
                         * Encodes the specified DmSegConfig message. Does not implicitly {@link bilibili.community.service.dm.v1.DmSegConfig.verify|verify} messages.
                         * @param message DmSegConfig message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.DmSegConfig.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified DmSegConfig message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.DmSegConfig.verify|verify} messages.
                         * @param message DmSegConfig message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.DmSegConfig.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a DmSegConfig message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.DmSegConfig & bilibili.community.service.dm.v1.DmSegConfig.$Shape} DmSegConfig
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.DmSegConfig & bilibili.community.service.dm.v1.DmSegConfig.$Shape;

                        /**
                         * Decodes a DmSegConfig message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.DmSegConfig & bilibili.community.service.dm.v1.DmSegConfig.$Shape} DmSegConfig
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.DmSegConfig & bilibili.community.service.dm.v1.DmSegConfig.$Shape;

                        /**
                         * Verifies a DmSegConfig message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a DmSegConfig message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns DmSegConfig
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.DmSegConfig;

                        /**
                         * Creates a plain object from a DmSegConfig message. Also converts values to other types if specified.
                         * @param message DmSegConfig
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.DmSegConfig, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this DmSegConfig to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for DmSegConfig
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace DmSegConfig {

                        /** Properties of a DmSegConfig. */
                        interface $Properties {

                            /** DmSegConfig pageSize */
                            pageSize?: (number|Long|null);

                            /** DmSegConfig total */
                            total?: (number|Long|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of a DmSegConfig. */
                        type $Shape = bilibili.community.service.dm.v1.DmSegConfig.$Properties;
                    }

                    /**
                     * Properties of a DmSegMobileReply.
                     * @deprecated Use bilibili.community.service.dm.v1.DmSegMobileReply.$Properties instead.
                     */
                    interface IDmSegMobileReply extends bilibili.community.service.dm.v1.DmSegMobileReply.$Properties {
                    }

                    /** Represents a DmSegMobileReply. */
                    class DmSegMobileReply {

                        /**
                         * Constructs a new DmSegMobileReply.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.DmSegMobileReply.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** DmSegMobileReply elems. */
                        elems: bilibili.community.service.dm.v1.DanmakuElem.$Properties[];

                        /** DmSegMobileReply state. */
                        state: number;

                        /** DmSegMobileReply aiFlag. */
                        aiFlag?: (bilibili.community.service.dm.v1.DanmakuAIFlag.$Properties|null);

                        /** DmSegMobileReply colorfulSrc. */
                        colorfulSrc: bilibili.community.service.dm.v1.DmColorful.$Properties[];

                        /**
                         * Creates a new DmSegMobileReply instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns DmSegMobileReply instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.DmSegMobileReply.$Shape): bilibili.community.service.dm.v1.DmSegMobileReply & bilibili.community.service.dm.v1.DmSegMobileReply.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.DmSegMobileReply.$Properties): bilibili.community.service.dm.v1.DmSegMobileReply;

                        /**
                         * Encodes the specified DmSegMobileReply message. Does not implicitly {@link bilibili.community.service.dm.v1.DmSegMobileReply.verify|verify} messages.
                         * @param message DmSegMobileReply message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.DmSegMobileReply.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified DmSegMobileReply message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.DmSegMobileReply.verify|verify} messages.
                         * @param message DmSegMobileReply message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.DmSegMobileReply.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a DmSegMobileReply message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.DmSegMobileReply & bilibili.community.service.dm.v1.DmSegMobileReply.$Shape} DmSegMobileReply
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.DmSegMobileReply & bilibili.community.service.dm.v1.DmSegMobileReply.$Shape;

                        /**
                         * Decodes a DmSegMobileReply message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.DmSegMobileReply & bilibili.community.service.dm.v1.DmSegMobileReply.$Shape} DmSegMobileReply
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.DmSegMobileReply & bilibili.community.service.dm.v1.DmSegMobileReply.$Shape;

                        /**
                         * Verifies a DmSegMobileReply message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a DmSegMobileReply message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns DmSegMobileReply
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.DmSegMobileReply;

                        /**
                         * Creates a plain object from a DmSegMobileReply message. Also converts values to other types if specified.
                         * @param message DmSegMobileReply
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.DmSegMobileReply, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this DmSegMobileReply to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for DmSegMobileReply
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace DmSegMobileReply {

                        /** Properties of a DmSegMobileReply. */
                        interface $Properties {

                            /** DmSegMobileReply elems */
                            elems?: (bilibili.community.service.dm.v1.DanmakuElem.$Properties[]|null);

                            /** DmSegMobileReply state */
                            state?: (number|null);

                            /** DmSegMobileReply aiFlag */
                            aiFlag?: (bilibili.community.service.dm.v1.DanmakuAIFlag.$Properties|null);

                            /** DmSegMobileReply colorfulSrc */
                            colorfulSrc?: (bilibili.community.service.dm.v1.DmColorful.$Properties[]|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of a DmSegMobileReply. */
                        type $Shape = bilibili.community.service.dm.v1.DmSegMobileReply.$Properties;
                    }

                    /**
                     * Properties of a DmSegMobileReq.
                     * @deprecated Use bilibili.community.service.dm.v1.DmSegMobileReq.$Properties instead.
                     */
                    interface IDmSegMobileReq extends bilibili.community.service.dm.v1.DmSegMobileReq.$Properties {
                    }

                    /** Represents a DmSegMobileReq. */
                    class DmSegMobileReq {

                        /**
                         * Constructs a new DmSegMobileReq.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.DmSegMobileReq.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** DmSegMobileReq pid. */
                        pid: (number|Long);

                        /** DmSegMobileReq oid. */
                        oid: (number|Long);

                        /** DmSegMobileReq type. */
                        type: number;

                        /** DmSegMobileReq segmentIndex. */
                        segmentIndex: (number|Long);

                        /** DmSegMobileReq teenagersMode. */
                        teenagersMode: number;

                        /** DmSegMobileReq ps. */
                        ps: (number|Long);

                        /** DmSegMobileReq pe. */
                        pe: (number|Long);

                        /** DmSegMobileReq pullMode. */
                        pullMode: number;

                        /** DmSegMobileReq fromScene. */
                        fromScene: number;

                        /**
                         * Creates a new DmSegMobileReq instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns DmSegMobileReq instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.DmSegMobileReq.$Shape): bilibili.community.service.dm.v1.DmSegMobileReq & bilibili.community.service.dm.v1.DmSegMobileReq.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.DmSegMobileReq.$Properties): bilibili.community.service.dm.v1.DmSegMobileReq;

                        /**
                         * Encodes the specified DmSegMobileReq message. Does not implicitly {@link bilibili.community.service.dm.v1.DmSegMobileReq.verify|verify} messages.
                         * @param message DmSegMobileReq message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.DmSegMobileReq.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified DmSegMobileReq message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.DmSegMobileReq.verify|verify} messages.
                         * @param message DmSegMobileReq message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.DmSegMobileReq.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a DmSegMobileReq message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.DmSegMobileReq & bilibili.community.service.dm.v1.DmSegMobileReq.$Shape} DmSegMobileReq
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.DmSegMobileReq & bilibili.community.service.dm.v1.DmSegMobileReq.$Shape;

                        /**
                         * Decodes a DmSegMobileReq message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.DmSegMobileReq & bilibili.community.service.dm.v1.DmSegMobileReq.$Shape} DmSegMobileReq
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.DmSegMobileReq & bilibili.community.service.dm.v1.DmSegMobileReq.$Shape;

                        /**
                         * Verifies a DmSegMobileReq message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a DmSegMobileReq message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns DmSegMobileReq
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.DmSegMobileReq;

                        /**
                         * Creates a plain object from a DmSegMobileReq message. Also converts values to other types if specified.
                         * @param message DmSegMobileReq
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.DmSegMobileReq, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this DmSegMobileReq to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for DmSegMobileReq
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace DmSegMobileReq {

                        /** Properties of a DmSegMobileReq. */
                        interface $Properties {

                            /** DmSegMobileReq pid */
                            pid?: (number|Long|null);

                            /** DmSegMobileReq oid */
                            oid?: (number|Long|null);

                            /** DmSegMobileReq type */
                            type?: (number|null);

                            /** DmSegMobileReq segmentIndex */
                            segmentIndex?: (number|Long|null);

                            /** DmSegMobileReq teenagersMode */
                            teenagersMode?: (number|null);

                            /** DmSegMobileReq ps */
                            ps?: (number|Long|null);

                            /** DmSegMobileReq pe */
                            pe?: (number|Long|null);

                            /** DmSegMobileReq pullMode */
                            pullMode?: (number|null);

                            /** DmSegMobileReq fromScene */
                            fromScene?: (number|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of a DmSegMobileReq. */
                        type $Shape = bilibili.community.service.dm.v1.DmSegMobileReq.$Properties;
                    }

                    /**
                     * Properties of a DmSegOttReply.
                     * @deprecated Use bilibili.community.service.dm.v1.DmSegOttReply.$Properties instead.
                     */
                    interface IDmSegOttReply extends bilibili.community.service.dm.v1.DmSegOttReply.$Properties {
                    }

                    /** Represents a DmSegOttReply. */
                    class DmSegOttReply {

                        /**
                         * Constructs a new DmSegOttReply.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.DmSegOttReply.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** DmSegOttReply closed. */
                        closed: boolean;

                        /** DmSegOttReply elems. */
                        elems: bilibili.community.service.dm.v1.DanmakuElem.$Properties[];

                        /**
                         * Creates a new DmSegOttReply instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns DmSegOttReply instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.DmSegOttReply.$Shape): bilibili.community.service.dm.v1.DmSegOttReply & bilibili.community.service.dm.v1.DmSegOttReply.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.DmSegOttReply.$Properties): bilibili.community.service.dm.v1.DmSegOttReply;

                        /**
                         * Encodes the specified DmSegOttReply message. Does not implicitly {@link bilibili.community.service.dm.v1.DmSegOttReply.verify|verify} messages.
                         * @param message DmSegOttReply message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.DmSegOttReply.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified DmSegOttReply message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.DmSegOttReply.verify|verify} messages.
                         * @param message DmSegOttReply message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.DmSegOttReply.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a DmSegOttReply message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.DmSegOttReply & bilibili.community.service.dm.v1.DmSegOttReply.$Shape} DmSegOttReply
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.DmSegOttReply & bilibili.community.service.dm.v1.DmSegOttReply.$Shape;

                        /**
                         * Decodes a DmSegOttReply message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.DmSegOttReply & bilibili.community.service.dm.v1.DmSegOttReply.$Shape} DmSegOttReply
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.DmSegOttReply & bilibili.community.service.dm.v1.DmSegOttReply.$Shape;

                        /**
                         * Verifies a DmSegOttReply message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a DmSegOttReply message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns DmSegOttReply
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.DmSegOttReply;

                        /**
                         * Creates a plain object from a DmSegOttReply message. Also converts values to other types if specified.
                         * @param message DmSegOttReply
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.DmSegOttReply, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this DmSegOttReply to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for DmSegOttReply
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace DmSegOttReply {

                        /** Properties of a DmSegOttReply. */
                        interface $Properties {

                            /** DmSegOttReply closed */
                            closed?: (boolean|null);

                            /** DmSegOttReply elems */
                            elems?: (bilibili.community.service.dm.v1.DanmakuElem.$Properties[]|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of a DmSegOttReply. */
                        type $Shape = bilibili.community.service.dm.v1.DmSegOttReply.$Properties;
                    }

                    /**
                     * Properties of a DmSegOttReq.
                     * @deprecated Use bilibili.community.service.dm.v1.DmSegOttReq.$Properties instead.
                     */
                    interface IDmSegOttReq extends bilibili.community.service.dm.v1.DmSegOttReq.$Properties {
                    }

                    /** Represents a DmSegOttReq. */
                    class DmSegOttReq {

                        /**
                         * Constructs a new DmSegOttReq.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.DmSegOttReq.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** DmSegOttReq pid. */
                        pid: (number|Long);

                        /** DmSegOttReq oid. */
                        oid: (number|Long);

                        /** DmSegOttReq type. */
                        type: number;

                        /** DmSegOttReq segmentIndex. */
                        segmentIndex: (number|Long);

                        /**
                         * Creates a new DmSegOttReq instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns DmSegOttReq instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.DmSegOttReq.$Shape): bilibili.community.service.dm.v1.DmSegOttReq & bilibili.community.service.dm.v1.DmSegOttReq.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.DmSegOttReq.$Properties): bilibili.community.service.dm.v1.DmSegOttReq;

                        /**
                         * Encodes the specified DmSegOttReq message. Does not implicitly {@link bilibili.community.service.dm.v1.DmSegOttReq.verify|verify} messages.
                         * @param message DmSegOttReq message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.DmSegOttReq.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified DmSegOttReq message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.DmSegOttReq.verify|verify} messages.
                         * @param message DmSegOttReq message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.DmSegOttReq.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a DmSegOttReq message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.DmSegOttReq & bilibili.community.service.dm.v1.DmSegOttReq.$Shape} DmSegOttReq
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.DmSegOttReq & bilibili.community.service.dm.v1.DmSegOttReq.$Shape;

                        /**
                         * Decodes a DmSegOttReq message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.DmSegOttReq & bilibili.community.service.dm.v1.DmSegOttReq.$Shape} DmSegOttReq
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.DmSegOttReq & bilibili.community.service.dm.v1.DmSegOttReq.$Shape;

                        /**
                         * Verifies a DmSegOttReq message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a DmSegOttReq message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns DmSegOttReq
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.DmSegOttReq;

                        /**
                         * Creates a plain object from a DmSegOttReq message. Also converts values to other types if specified.
                         * @param message DmSegOttReq
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.DmSegOttReq, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this DmSegOttReq to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for DmSegOttReq
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace DmSegOttReq {

                        /** Properties of a DmSegOttReq. */
                        interface $Properties {

                            /** DmSegOttReq pid */
                            pid?: (number|Long|null);

                            /** DmSegOttReq oid */
                            oid?: (number|Long|null);

                            /** DmSegOttReq type */
                            type?: (number|null);

                            /** DmSegOttReq segmentIndex */
                            segmentIndex?: (number|Long|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of a DmSegOttReq. */
                        type $Shape = bilibili.community.service.dm.v1.DmSegOttReq.$Properties;
                    }

                    /**
                     * Properties of a DmSegSDKReply.
                     * @deprecated Use bilibili.community.service.dm.v1.DmSegSDKReply.$Properties instead.
                     */
                    interface IDmSegSDKReply extends bilibili.community.service.dm.v1.DmSegSDKReply.$Properties {
                    }

                    /** Represents a DmSegSDKReply. */
                    class DmSegSDKReply {

                        /**
                         * Constructs a new DmSegSDKReply.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.DmSegSDKReply.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** DmSegSDKReply closed. */
                        closed: boolean;

                        /** DmSegSDKReply elems. */
                        elems: bilibili.community.service.dm.v1.DanmakuElem.$Properties[];

                        /**
                         * Creates a new DmSegSDKReply instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns DmSegSDKReply instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.DmSegSDKReply.$Shape): bilibili.community.service.dm.v1.DmSegSDKReply & bilibili.community.service.dm.v1.DmSegSDKReply.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.DmSegSDKReply.$Properties): bilibili.community.service.dm.v1.DmSegSDKReply;

                        /**
                         * Encodes the specified DmSegSDKReply message. Does not implicitly {@link bilibili.community.service.dm.v1.DmSegSDKReply.verify|verify} messages.
                         * @param message DmSegSDKReply message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.DmSegSDKReply.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified DmSegSDKReply message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.DmSegSDKReply.verify|verify} messages.
                         * @param message DmSegSDKReply message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.DmSegSDKReply.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a DmSegSDKReply message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.DmSegSDKReply & bilibili.community.service.dm.v1.DmSegSDKReply.$Shape} DmSegSDKReply
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.DmSegSDKReply & bilibili.community.service.dm.v1.DmSegSDKReply.$Shape;

                        /**
                         * Decodes a DmSegSDKReply message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.DmSegSDKReply & bilibili.community.service.dm.v1.DmSegSDKReply.$Shape} DmSegSDKReply
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.DmSegSDKReply & bilibili.community.service.dm.v1.DmSegSDKReply.$Shape;

                        /**
                         * Verifies a DmSegSDKReply message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a DmSegSDKReply message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns DmSegSDKReply
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.DmSegSDKReply;

                        /**
                         * Creates a plain object from a DmSegSDKReply message. Also converts values to other types if specified.
                         * @param message DmSegSDKReply
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.DmSegSDKReply, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this DmSegSDKReply to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for DmSegSDKReply
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace DmSegSDKReply {

                        /** Properties of a DmSegSDKReply. */
                        interface $Properties {

                            /** DmSegSDKReply closed */
                            closed?: (boolean|null);

                            /** DmSegSDKReply elems */
                            elems?: (bilibili.community.service.dm.v1.DanmakuElem.$Properties[]|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of a DmSegSDKReply. */
                        type $Shape = bilibili.community.service.dm.v1.DmSegSDKReply.$Properties;
                    }

                    /**
                     * Properties of a DmSegSDKReq.
                     * @deprecated Use bilibili.community.service.dm.v1.DmSegSDKReq.$Properties instead.
                     */
                    interface IDmSegSDKReq extends bilibili.community.service.dm.v1.DmSegSDKReq.$Properties {
                    }

                    /** Represents a DmSegSDKReq. */
                    class DmSegSDKReq {

                        /**
                         * Constructs a new DmSegSDKReq.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.DmSegSDKReq.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** DmSegSDKReq pid. */
                        pid: (number|Long);

                        /** DmSegSDKReq oid. */
                        oid: (number|Long);

                        /** DmSegSDKReq type. */
                        type: number;

                        /** DmSegSDKReq segmentIndex. */
                        segmentIndex: (number|Long);

                        /**
                         * Creates a new DmSegSDKReq instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns DmSegSDKReq instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.DmSegSDKReq.$Shape): bilibili.community.service.dm.v1.DmSegSDKReq & bilibili.community.service.dm.v1.DmSegSDKReq.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.DmSegSDKReq.$Properties): bilibili.community.service.dm.v1.DmSegSDKReq;

                        /**
                         * Encodes the specified DmSegSDKReq message. Does not implicitly {@link bilibili.community.service.dm.v1.DmSegSDKReq.verify|verify} messages.
                         * @param message DmSegSDKReq message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.DmSegSDKReq.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified DmSegSDKReq message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.DmSegSDKReq.verify|verify} messages.
                         * @param message DmSegSDKReq message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.DmSegSDKReq.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a DmSegSDKReq message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.DmSegSDKReq & bilibili.community.service.dm.v1.DmSegSDKReq.$Shape} DmSegSDKReq
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.DmSegSDKReq & bilibili.community.service.dm.v1.DmSegSDKReq.$Shape;

                        /**
                         * Decodes a DmSegSDKReq message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.DmSegSDKReq & bilibili.community.service.dm.v1.DmSegSDKReq.$Shape} DmSegSDKReq
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.DmSegSDKReq & bilibili.community.service.dm.v1.DmSegSDKReq.$Shape;

                        /**
                         * Verifies a DmSegSDKReq message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a DmSegSDKReq message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns DmSegSDKReq
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.DmSegSDKReq;

                        /**
                         * Creates a plain object from a DmSegSDKReq message. Also converts values to other types if specified.
                         * @param message DmSegSDKReq
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.DmSegSDKReq, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this DmSegSDKReq to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for DmSegSDKReq
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace DmSegSDKReq {

                        /** Properties of a DmSegSDKReq. */
                        interface $Properties {

                            /** DmSegSDKReq pid */
                            pid?: (number|Long|null);

                            /** DmSegSDKReq oid */
                            oid?: (number|Long|null);

                            /** DmSegSDKReq type */
                            type?: (number|null);

                            /** DmSegSDKReq segmentIndex */
                            segmentIndex?: (number|Long|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of a DmSegSDKReq. */
                        type $Shape = bilibili.community.service.dm.v1.DmSegSDKReq.$Properties;
                    }

                    /**
                     * Properties of a DmViewReply.
                     * @deprecated Use bilibili.community.service.dm.v1.DmViewReply.$Properties instead.
                     */
                    interface IDmViewReply extends bilibili.community.service.dm.v1.DmViewReply.$Properties {
                    }

                    /** Represents a DmViewReply. */
                    class DmViewReply {

                        /**
                         * Constructs a new DmViewReply.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.DmViewReply.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** DmViewReply closed. */
                        closed: boolean;

                        /** DmViewReply mask. */
                        mask?: (bilibili.community.service.dm.v1.VideoMask.$Properties|null);

                        /** DmViewReply subtitle. */
                        subtitle?: (bilibili.community.service.dm.v1.VideoSubtitle.$Properties|null);

                        /** DmViewReply specialDms. */
                        specialDms: string[];

                        /** DmViewReply aiFlag. */
                        aiFlag?: (bilibili.community.service.dm.v1.DanmakuFlagConfig.$Properties|null);

                        /** DmViewReply playerConfig. */
                        playerConfig?: (bilibili.community.service.dm.v1.DanmuPlayerViewConfig.$Properties|null);

                        /** DmViewReply sendBoxStyle. */
                        sendBoxStyle: number;

                        /** DmViewReply allow. */
                        allow: boolean;

                        /** DmViewReply checkBox. */
                        checkBox: string;

                        /** DmViewReply checkBoxShowMsg. */
                        checkBoxShowMsg: string;

                        /** DmViewReply textPlaceholder. */
                        textPlaceholder: string;

                        /** DmViewReply inputPlaceholder. */
                        inputPlaceholder: string;

                        /** DmViewReply reportFilterContent. */
                        reportFilterContent: string[];

                        /** DmViewReply expoReport. */
                        expoReport?: (bilibili.community.service.dm.v1.ExpoReport.$Properties|null);

                        /** DmViewReply buzzwordConfig. */
                        buzzwordConfig?: (bilibili.community.service.dm.v1.BuzzwordConfig.$Properties|null);

                        /** DmViewReply expressions. */
                        expressions: bilibili.community.service.dm.v1.Expressions.$Properties[];

                        /** DmViewReply postPanel. */
                        postPanel: bilibili.community.service.dm.v1.PostPanel.$Properties[];

                        /** DmViewReply activityMeta. */
                        activityMeta: string[];

                        /** DmViewReply postPanel2. */
                        postPanel2: bilibili.community.service.dm.v1.PostPanelV2.$Properties[];

                        /**
                         * Creates a new DmViewReply instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns DmViewReply instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.DmViewReply.$Shape): bilibili.community.service.dm.v1.DmViewReply & bilibili.community.service.dm.v1.DmViewReply.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.DmViewReply.$Properties): bilibili.community.service.dm.v1.DmViewReply;

                        /**
                         * Encodes the specified DmViewReply message. Does not implicitly {@link bilibili.community.service.dm.v1.DmViewReply.verify|verify} messages.
                         * @param message DmViewReply message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.DmViewReply.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified DmViewReply message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.DmViewReply.verify|verify} messages.
                         * @param message DmViewReply message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.DmViewReply.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a DmViewReply message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.DmViewReply & bilibili.community.service.dm.v1.DmViewReply.$Shape} DmViewReply
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.DmViewReply & bilibili.community.service.dm.v1.DmViewReply.$Shape;

                        /**
                         * Decodes a DmViewReply message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.DmViewReply & bilibili.community.service.dm.v1.DmViewReply.$Shape} DmViewReply
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.DmViewReply & bilibili.community.service.dm.v1.DmViewReply.$Shape;

                        /**
                         * Verifies a DmViewReply message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a DmViewReply message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns DmViewReply
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.DmViewReply;

                        /**
                         * Creates a plain object from a DmViewReply message. Also converts values to other types if specified.
                         * @param message DmViewReply
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.DmViewReply, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this DmViewReply to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for DmViewReply
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace DmViewReply {

                        /** Properties of a DmViewReply. */
                        interface $Properties {

                            /** DmViewReply closed */
                            closed?: (boolean|null);

                            /** DmViewReply mask */
                            mask?: (bilibili.community.service.dm.v1.VideoMask.$Properties|null);

                            /** DmViewReply subtitle */
                            subtitle?: (bilibili.community.service.dm.v1.VideoSubtitle.$Properties|null);

                            /** DmViewReply specialDms */
                            specialDms?: (string[]|null);

                            /** DmViewReply aiFlag */
                            aiFlag?: (bilibili.community.service.dm.v1.DanmakuFlagConfig.$Properties|null);

                            /** DmViewReply playerConfig */
                            playerConfig?: (bilibili.community.service.dm.v1.DanmuPlayerViewConfig.$Properties|null);

                            /** DmViewReply sendBoxStyle */
                            sendBoxStyle?: (number|null);

                            /** DmViewReply allow */
                            allow?: (boolean|null);

                            /** DmViewReply checkBox */
                            checkBox?: (string|null);

                            /** DmViewReply checkBoxShowMsg */
                            checkBoxShowMsg?: (string|null);

                            /** DmViewReply textPlaceholder */
                            textPlaceholder?: (string|null);

                            /** DmViewReply inputPlaceholder */
                            inputPlaceholder?: (string|null);

                            /** DmViewReply reportFilterContent */
                            reportFilterContent?: (string[]|null);

                            /** DmViewReply expoReport */
                            expoReport?: (bilibili.community.service.dm.v1.ExpoReport.$Properties|null);

                            /** DmViewReply buzzwordConfig */
                            buzzwordConfig?: (bilibili.community.service.dm.v1.BuzzwordConfig.$Properties|null);

                            /** DmViewReply expressions */
                            expressions?: (bilibili.community.service.dm.v1.Expressions.$Properties[]|null);

                            /** DmViewReply postPanel */
                            postPanel?: (bilibili.community.service.dm.v1.PostPanel.$Properties[]|null);

                            /** DmViewReply activityMeta */
                            activityMeta?: (string[]|null);

                            /** DmViewReply postPanel2 */
                            postPanel2?: (bilibili.community.service.dm.v1.PostPanelV2.$Properties[]|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of a DmViewReply. */
                        type $Shape = bilibili.community.service.dm.v1.DmViewReply.$Properties;
                    }

                    /**
                     * Properties of a DmViewReq.
                     * @deprecated Use bilibili.community.service.dm.v1.DmViewReq.$Properties instead.
                     */
                    interface IDmViewReq extends bilibili.community.service.dm.v1.DmViewReq.$Properties {
                    }

                    /** Represents a DmViewReq. */
                    class DmViewReq {

                        /**
                         * Constructs a new DmViewReq.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.DmViewReq.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** DmViewReq pid. */
                        pid: (number|Long);

                        /** DmViewReq oid. */
                        oid: (number|Long);

                        /** DmViewReq type. */
                        type: number;

                        /** DmViewReq spmid. */
                        spmid: string;

                        /** DmViewReq isHardBoot. */
                        isHardBoot: number;

                        /**
                         * Creates a new DmViewReq instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns DmViewReq instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.DmViewReq.$Shape): bilibili.community.service.dm.v1.DmViewReq & bilibili.community.service.dm.v1.DmViewReq.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.DmViewReq.$Properties): bilibili.community.service.dm.v1.DmViewReq;

                        /**
                         * Encodes the specified DmViewReq message. Does not implicitly {@link bilibili.community.service.dm.v1.DmViewReq.verify|verify} messages.
                         * @param message DmViewReq message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.DmViewReq.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified DmViewReq message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.DmViewReq.verify|verify} messages.
                         * @param message DmViewReq message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.DmViewReq.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a DmViewReq message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.DmViewReq & bilibili.community.service.dm.v1.DmViewReq.$Shape} DmViewReq
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.DmViewReq & bilibili.community.service.dm.v1.DmViewReq.$Shape;

                        /**
                         * Decodes a DmViewReq message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.DmViewReq & bilibili.community.service.dm.v1.DmViewReq.$Shape} DmViewReq
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.DmViewReq & bilibili.community.service.dm.v1.DmViewReq.$Shape;

                        /**
                         * Verifies a DmViewReq message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a DmViewReq message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns DmViewReq
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.DmViewReq;

                        /**
                         * Creates a plain object from a DmViewReq message. Also converts values to other types if specified.
                         * @param message DmViewReq
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.DmViewReq, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this DmViewReq to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for DmViewReq
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace DmViewReq {

                        /** Properties of a DmViewReq. */
                        interface $Properties {

                            /** DmViewReq pid */
                            pid?: (number|Long|null);

                            /** DmViewReq oid */
                            oid?: (number|Long|null);

                            /** DmViewReq type */
                            type?: (number|null);

                            /** DmViewReq spmid */
                            spmid?: (string|null);

                            /** DmViewReq isHardBoot */
                            isHardBoot?: (number|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of a DmViewReq. */
                        type $Shape = bilibili.community.service.dm.v1.DmViewReq.$Properties;
                    }

                    /**
                     * Properties of a DmWebViewReply.
                     * @deprecated Use bilibili.community.service.dm.v1.DmWebViewReply.$Properties instead.
                     */
                    interface IDmWebViewReply extends bilibili.community.service.dm.v1.DmWebViewReply.$Properties {
                    }

                    /** Represents a DmWebViewReply. */
                    class DmWebViewReply {

                        /**
                         * Constructs a new DmWebViewReply.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.DmWebViewReply.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** DmWebViewReply state. */
                        state: number;

                        /** DmWebViewReply text. */
                        text: string;

                        /** DmWebViewReply textSide. */
                        textSide: string;

                        /** DmWebViewReply dmSge. */
                        dmSge?: (bilibili.community.service.dm.v1.DmSegConfig.$Properties|null);

                        /** DmWebViewReply flag. */
                        flag?: (bilibili.community.service.dm.v1.DanmakuFlagConfig.$Properties|null);

                        /** DmWebViewReply specialDms. */
                        specialDms: string[];

                        /** DmWebViewReply checkBox. */
                        checkBox: boolean;

                        /** DmWebViewReply count. */
                        count: (number|Long);

                        /** DmWebViewReply commandDms. */
                        commandDms: bilibili.community.service.dm.v1.CommandDm.$Properties[];

                        /** DmWebViewReply playerConfig. */
                        playerConfig?: (bilibili.community.service.dm.v1.DanmuWebPlayerConfig.$Properties|null);

                        /** DmWebViewReply reportFilterContent. */
                        reportFilterContent: string[];

                        /** DmWebViewReply expressions. */
                        expressions: bilibili.community.service.dm.v1.Expressions.$Properties[];

                        /** DmWebViewReply postPanel. */
                        postPanel: bilibili.community.service.dm.v1.PostPanel.$Properties[];

                        /** DmWebViewReply activityMeta. */
                        activityMeta: string[];

                        /**
                         * Creates a new DmWebViewReply instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns DmWebViewReply instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.DmWebViewReply.$Shape): bilibili.community.service.dm.v1.DmWebViewReply & bilibili.community.service.dm.v1.DmWebViewReply.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.DmWebViewReply.$Properties): bilibili.community.service.dm.v1.DmWebViewReply;

                        /**
                         * Encodes the specified DmWebViewReply message. Does not implicitly {@link bilibili.community.service.dm.v1.DmWebViewReply.verify|verify} messages.
                         * @param message DmWebViewReply message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.DmWebViewReply.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified DmWebViewReply message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.DmWebViewReply.verify|verify} messages.
                         * @param message DmWebViewReply message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.DmWebViewReply.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a DmWebViewReply message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.DmWebViewReply & bilibili.community.service.dm.v1.DmWebViewReply.$Shape} DmWebViewReply
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.DmWebViewReply & bilibili.community.service.dm.v1.DmWebViewReply.$Shape;

                        /**
                         * Decodes a DmWebViewReply message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.DmWebViewReply & bilibili.community.service.dm.v1.DmWebViewReply.$Shape} DmWebViewReply
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.DmWebViewReply & bilibili.community.service.dm.v1.DmWebViewReply.$Shape;

                        /**
                         * Verifies a DmWebViewReply message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a DmWebViewReply message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns DmWebViewReply
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.DmWebViewReply;

                        /**
                         * Creates a plain object from a DmWebViewReply message. Also converts values to other types if specified.
                         * @param message DmWebViewReply
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.DmWebViewReply, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this DmWebViewReply to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for DmWebViewReply
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace DmWebViewReply {

                        /** Properties of a DmWebViewReply. */
                        interface $Properties {

                            /** DmWebViewReply state */
                            state?: (number|null);

                            /** DmWebViewReply text */
                            text?: (string|null);

                            /** DmWebViewReply textSide */
                            textSide?: (string|null);

                            /** DmWebViewReply dmSge */
                            dmSge?: (bilibili.community.service.dm.v1.DmSegConfig.$Properties|null);

                            /** DmWebViewReply flag */
                            flag?: (bilibili.community.service.dm.v1.DanmakuFlagConfig.$Properties|null);

                            /** DmWebViewReply specialDms */
                            specialDms?: (string[]|null);

                            /** DmWebViewReply checkBox */
                            checkBox?: (boolean|null);

                            /** DmWebViewReply count */
                            count?: (number|Long|null);

                            /** DmWebViewReply commandDms */
                            commandDms?: (bilibili.community.service.dm.v1.CommandDm.$Properties[]|null);

                            /** DmWebViewReply playerConfig */
                            playerConfig?: (bilibili.community.service.dm.v1.DanmuWebPlayerConfig.$Properties|null);

                            /** DmWebViewReply reportFilterContent */
                            reportFilterContent?: (string[]|null);

                            /** DmWebViewReply expressions */
                            expressions?: (bilibili.community.service.dm.v1.Expressions.$Properties[]|null);

                            /** DmWebViewReply postPanel */
                            postPanel?: (bilibili.community.service.dm.v1.PostPanel.$Properties[]|null);

                            /** DmWebViewReply activityMeta */
                            activityMeta?: (string[]|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of a DmWebViewReply. */
                        type $Shape = bilibili.community.service.dm.v1.DmWebViewReply.$Properties;
                    }

                    /**
                     * Properties of an ExpoReport.
                     * @deprecated Use bilibili.community.service.dm.v1.ExpoReport.$Properties instead.
                     */
                    interface IExpoReport extends bilibili.community.service.dm.v1.ExpoReport.$Properties {
                    }

                    /** Represents an ExpoReport. */
                    class ExpoReport {

                        /**
                         * Constructs a new ExpoReport.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.ExpoReport.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** ExpoReport shouldReportAtEnd. */
                        shouldReportAtEnd: boolean;

                        /**
                         * Creates a new ExpoReport instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns ExpoReport instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.ExpoReport.$Shape): bilibili.community.service.dm.v1.ExpoReport & bilibili.community.service.dm.v1.ExpoReport.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.ExpoReport.$Properties): bilibili.community.service.dm.v1.ExpoReport;

                        /**
                         * Encodes the specified ExpoReport message. Does not implicitly {@link bilibili.community.service.dm.v1.ExpoReport.verify|verify} messages.
                         * @param message ExpoReport message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.ExpoReport.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified ExpoReport message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.ExpoReport.verify|verify} messages.
                         * @param message ExpoReport message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.ExpoReport.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes an ExpoReport message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.ExpoReport & bilibili.community.service.dm.v1.ExpoReport.$Shape} ExpoReport
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.ExpoReport & bilibili.community.service.dm.v1.ExpoReport.$Shape;

                        /**
                         * Decodes an ExpoReport message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.ExpoReport & bilibili.community.service.dm.v1.ExpoReport.$Shape} ExpoReport
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.ExpoReport & bilibili.community.service.dm.v1.ExpoReport.$Shape;

                        /**
                         * Verifies an ExpoReport message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates an ExpoReport message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns ExpoReport
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.ExpoReport;

                        /**
                         * Creates a plain object from an ExpoReport message. Also converts values to other types if specified.
                         * @param message ExpoReport
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.ExpoReport, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this ExpoReport to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for ExpoReport
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace ExpoReport {

                        /** Properties of an ExpoReport. */
                        interface $Properties {

                            /** ExpoReport shouldReportAtEnd */
                            shouldReportAtEnd?: (boolean|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of an ExpoReport. */
                        type $Shape = bilibili.community.service.dm.v1.ExpoReport.$Properties;
                    }

                    /** ExposureType enum. */
                    enum ExposureType {

                        /** ExposureTypeNone value */
                        ExposureTypeNone = 0,

                        /** ExposureTypeDMSend value */
                        ExposureTypeDMSend = 1
                    }

                    /**
                     * Properties of an Expression.
                     * @deprecated Use bilibili.community.service.dm.v1.Expression.$Properties instead.
                     */
                    interface IExpression extends bilibili.community.service.dm.v1.Expression.$Properties {
                    }

                    /** Represents an Expression. */
                    class Expression {

                        /**
                         * Constructs a new Expression.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.Expression.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** Expression keyword. */
                        keyword: string[];

                        /** Expression url. */
                        url: string;

                        /** Expression period. */
                        period: bilibili.community.service.dm.v1.Period.$Properties[];

                        /**
                         * Creates a new Expression instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns Expression instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.Expression.$Shape): bilibili.community.service.dm.v1.Expression & bilibili.community.service.dm.v1.Expression.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.Expression.$Properties): bilibili.community.service.dm.v1.Expression;

                        /**
                         * Encodes the specified Expression message. Does not implicitly {@link bilibili.community.service.dm.v1.Expression.verify|verify} messages.
                         * @param message Expression message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.Expression.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified Expression message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.Expression.verify|verify} messages.
                         * @param message Expression message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.Expression.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes an Expression message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.Expression & bilibili.community.service.dm.v1.Expression.$Shape} Expression
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.Expression & bilibili.community.service.dm.v1.Expression.$Shape;

                        /**
                         * Decodes an Expression message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.Expression & bilibili.community.service.dm.v1.Expression.$Shape} Expression
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.Expression & bilibili.community.service.dm.v1.Expression.$Shape;

                        /**
                         * Verifies an Expression message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates an Expression message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns Expression
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.Expression;

                        /**
                         * Creates a plain object from an Expression message. Also converts values to other types if specified.
                         * @param message Expression
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.Expression, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this Expression to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for Expression
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace Expression {

                        /** Properties of an Expression. */
                        interface $Properties {

                            /** Expression keyword */
                            keyword?: (string[]|null);

                            /** Expression url */
                            url?: (string|null);

                            /** Expression period */
                            period?: (bilibili.community.service.dm.v1.Period.$Properties[]|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of an Expression. */
                        type $Shape = bilibili.community.service.dm.v1.Expression.$Properties;
                    }

                    /**
                     * Properties of an Expressions.
                     * @deprecated Use bilibili.community.service.dm.v1.Expressions.$Properties instead.
                     */
                    interface IExpressions extends bilibili.community.service.dm.v1.Expressions.$Properties {
                    }

                    /** Represents an Expressions. */
                    class Expressions {

                        /**
                         * Constructs a new Expressions.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.Expressions.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** Expressions data. */
                        data: bilibili.community.service.dm.v1.Expression.$Properties[];

                        /**
                         * Creates a new Expressions instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns Expressions instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.Expressions.$Shape): bilibili.community.service.dm.v1.Expressions & bilibili.community.service.dm.v1.Expressions.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.Expressions.$Properties): bilibili.community.service.dm.v1.Expressions;

                        /**
                         * Encodes the specified Expressions message. Does not implicitly {@link bilibili.community.service.dm.v1.Expressions.verify|verify} messages.
                         * @param message Expressions message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.Expressions.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified Expressions message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.Expressions.verify|verify} messages.
                         * @param message Expressions message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.Expressions.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes an Expressions message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.Expressions & bilibili.community.service.dm.v1.Expressions.$Shape} Expressions
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.Expressions & bilibili.community.service.dm.v1.Expressions.$Shape;

                        /**
                         * Decodes an Expressions message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.Expressions & bilibili.community.service.dm.v1.Expressions.$Shape} Expressions
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.Expressions & bilibili.community.service.dm.v1.Expressions.$Shape;

                        /**
                         * Verifies an Expressions message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates an Expressions message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns Expressions
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.Expressions;

                        /**
                         * Creates a plain object from an Expressions message. Also converts values to other types if specified.
                         * @param message Expressions
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.Expressions, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this Expressions to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for Expressions
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace Expressions {

                        /** Properties of an Expressions. */
                        interface $Properties {

                            /** Expressions data */
                            data?: (bilibili.community.service.dm.v1.Expression.$Properties[]|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of an Expressions. */
                        type $Shape = bilibili.community.service.dm.v1.Expressions.$Properties;
                    }

                    /**
                     * Properties of an InlinePlayerDanmakuSwitch.
                     * @deprecated Use bilibili.community.service.dm.v1.InlinePlayerDanmakuSwitch.$Properties instead.
                     */
                    interface IInlinePlayerDanmakuSwitch extends bilibili.community.service.dm.v1.InlinePlayerDanmakuSwitch.$Properties {
                    }

                    /** Represents an InlinePlayerDanmakuSwitch. */
                    class InlinePlayerDanmakuSwitch {

                        /**
                         * Constructs a new InlinePlayerDanmakuSwitch.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.InlinePlayerDanmakuSwitch.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** InlinePlayerDanmakuSwitch value. */
                        value: boolean;

                        /**
                         * Creates a new InlinePlayerDanmakuSwitch instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns InlinePlayerDanmakuSwitch instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.InlinePlayerDanmakuSwitch.$Shape): bilibili.community.service.dm.v1.InlinePlayerDanmakuSwitch & bilibili.community.service.dm.v1.InlinePlayerDanmakuSwitch.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.InlinePlayerDanmakuSwitch.$Properties): bilibili.community.service.dm.v1.InlinePlayerDanmakuSwitch;

                        /**
                         * Encodes the specified InlinePlayerDanmakuSwitch message. Does not implicitly {@link bilibili.community.service.dm.v1.InlinePlayerDanmakuSwitch.verify|verify} messages.
                         * @param message InlinePlayerDanmakuSwitch message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.InlinePlayerDanmakuSwitch.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified InlinePlayerDanmakuSwitch message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.InlinePlayerDanmakuSwitch.verify|verify} messages.
                         * @param message InlinePlayerDanmakuSwitch message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.InlinePlayerDanmakuSwitch.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes an InlinePlayerDanmakuSwitch message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.InlinePlayerDanmakuSwitch & bilibili.community.service.dm.v1.InlinePlayerDanmakuSwitch.$Shape} InlinePlayerDanmakuSwitch
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.InlinePlayerDanmakuSwitch & bilibili.community.service.dm.v1.InlinePlayerDanmakuSwitch.$Shape;

                        /**
                         * Decodes an InlinePlayerDanmakuSwitch message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.InlinePlayerDanmakuSwitch & bilibili.community.service.dm.v1.InlinePlayerDanmakuSwitch.$Shape} InlinePlayerDanmakuSwitch
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.InlinePlayerDanmakuSwitch & bilibili.community.service.dm.v1.InlinePlayerDanmakuSwitch.$Shape;

                        /**
                         * Verifies an InlinePlayerDanmakuSwitch message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates an InlinePlayerDanmakuSwitch message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns InlinePlayerDanmakuSwitch
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.InlinePlayerDanmakuSwitch;

                        /**
                         * Creates a plain object from an InlinePlayerDanmakuSwitch message. Also converts values to other types if specified.
                         * @param message InlinePlayerDanmakuSwitch
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.InlinePlayerDanmakuSwitch, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this InlinePlayerDanmakuSwitch to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for InlinePlayerDanmakuSwitch
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace InlinePlayerDanmakuSwitch {

                        /** Properties of an InlinePlayerDanmakuSwitch. */
                        interface $Properties {

                            /** InlinePlayerDanmakuSwitch value */
                            value?: (boolean|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of an InlinePlayerDanmakuSwitch. */
                        type $Shape = bilibili.community.service.dm.v1.InlinePlayerDanmakuSwitch.$Properties;
                    }

                    /**
                     * Properties of a Label.
                     * @deprecated Use bilibili.community.service.dm.v1.Label.$Properties instead.
                     */
                    interface ILabel extends bilibili.community.service.dm.v1.Label.$Properties {
                    }

                    /** Represents a Label. */
                    class Label {

                        /**
                         * Constructs a new Label.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.Label.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** Label title. */
                        title: string;

                        /** Label content. */
                        content: string[];

                        /**
                         * Creates a new Label instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns Label instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.Label.$Shape): bilibili.community.service.dm.v1.Label & bilibili.community.service.dm.v1.Label.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.Label.$Properties): bilibili.community.service.dm.v1.Label;

                        /**
                         * Encodes the specified Label message. Does not implicitly {@link bilibili.community.service.dm.v1.Label.verify|verify} messages.
                         * @param message Label message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.Label.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified Label message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.Label.verify|verify} messages.
                         * @param message Label message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.Label.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a Label message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.Label & bilibili.community.service.dm.v1.Label.$Shape} Label
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.Label & bilibili.community.service.dm.v1.Label.$Shape;

                        /**
                         * Decodes a Label message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.Label & bilibili.community.service.dm.v1.Label.$Shape} Label
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.Label & bilibili.community.service.dm.v1.Label.$Shape;

                        /**
                         * Verifies a Label message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a Label message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns Label
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.Label;

                        /**
                         * Creates a plain object from a Label message. Also converts values to other types if specified.
                         * @param message Label
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.Label, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this Label to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for Label
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace Label {

                        /** Properties of a Label. */
                        interface $Properties {

                            /** Label title */
                            title?: (string|null);

                            /** Label content */
                            content?: (string[]|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of a Label. */
                        type $Shape = bilibili.community.service.dm.v1.Label.$Properties;
                    }

                    /**
                     * Properties of a LabelV2.
                     * @deprecated Use bilibili.community.service.dm.v1.LabelV2.$Properties instead.
                     */
                    interface ILabelV2 extends bilibili.community.service.dm.v1.LabelV2.$Properties {
                    }

                    /** Represents a LabelV2. */
                    class LabelV2 {

                        /**
                         * Constructs a new LabelV2.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.LabelV2.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** LabelV2 title. */
                        title: string;

                        /** LabelV2 content. */
                        content: string[];

                        /** LabelV2 exposureOnce. */
                        exposureOnce: boolean;

                        /** LabelV2 exposureType. */
                        exposureType: number;

                        /**
                         * Creates a new LabelV2 instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns LabelV2 instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.LabelV2.$Shape): bilibili.community.service.dm.v1.LabelV2 & bilibili.community.service.dm.v1.LabelV2.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.LabelV2.$Properties): bilibili.community.service.dm.v1.LabelV2;

                        /**
                         * Encodes the specified LabelV2 message. Does not implicitly {@link bilibili.community.service.dm.v1.LabelV2.verify|verify} messages.
                         * @param message LabelV2 message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.LabelV2.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified LabelV2 message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.LabelV2.verify|verify} messages.
                         * @param message LabelV2 message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.LabelV2.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a LabelV2 message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.LabelV2 & bilibili.community.service.dm.v1.LabelV2.$Shape} LabelV2
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.LabelV2 & bilibili.community.service.dm.v1.LabelV2.$Shape;

                        /**
                         * Decodes a LabelV2 message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.LabelV2 & bilibili.community.service.dm.v1.LabelV2.$Shape} LabelV2
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.LabelV2 & bilibili.community.service.dm.v1.LabelV2.$Shape;

                        /**
                         * Verifies a LabelV2 message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a LabelV2 message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns LabelV2
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.LabelV2;

                        /**
                         * Creates a plain object from a LabelV2 message. Also converts values to other types if specified.
                         * @param message LabelV2
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.LabelV2, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this LabelV2 to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for LabelV2
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace LabelV2 {

                        /** Properties of a LabelV2. */
                        interface $Properties {

                            /** LabelV2 title */
                            title?: (string|null);

                            /** LabelV2 content */
                            content?: (string[]|null);

                            /** LabelV2 exposureOnce */
                            exposureOnce?: (boolean|null);

                            /** LabelV2 exposureType */
                            exposureType?: (number|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of a LabelV2. */
                        type $Shape = bilibili.community.service.dm.v1.LabelV2.$Properties;
                    }

                    /**
                     * Properties of a Period.
                     * @deprecated Use bilibili.community.service.dm.v1.Period.$Properties instead.
                     */
                    interface IPeriod extends bilibili.community.service.dm.v1.Period.$Properties {
                    }

                    /** Represents a Period. */
                    class Period {

                        /**
                         * Constructs a new Period.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.Period.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** Period start. */
                        start: (number|Long);

                        /** Period end. */
                        end: (number|Long);

                        /**
                         * Creates a new Period instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns Period instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.Period.$Shape): bilibili.community.service.dm.v1.Period & bilibili.community.service.dm.v1.Period.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.Period.$Properties): bilibili.community.service.dm.v1.Period;

                        /**
                         * Encodes the specified Period message. Does not implicitly {@link bilibili.community.service.dm.v1.Period.verify|verify} messages.
                         * @param message Period message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.Period.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified Period message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.Period.verify|verify} messages.
                         * @param message Period message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.Period.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a Period message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.Period & bilibili.community.service.dm.v1.Period.$Shape} Period
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.Period & bilibili.community.service.dm.v1.Period.$Shape;

                        /**
                         * Decodes a Period message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.Period & bilibili.community.service.dm.v1.Period.$Shape} Period
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.Period & bilibili.community.service.dm.v1.Period.$Shape;

                        /**
                         * Verifies a Period message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a Period message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns Period
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.Period;

                        /**
                         * Creates a plain object from a Period message. Also converts values to other types if specified.
                         * @param message Period
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.Period, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this Period to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for Period
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace Period {

                        /** Properties of a Period. */
                        interface $Properties {

                            /** Period start */
                            start?: (number|Long|null);

                            /** Period end */
                            end?: (number|Long|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of a Period. */
                        type $Shape = bilibili.community.service.dm.v1.Period.$Properties;
                    }

                    /**
                     * Properties of a PlayerDanmakuAiRecommendedLevel.
                     * @deprecated Use bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedLevel.$Properties instead.
                     */
                    interface IPlayerDanmakuAiRecommendedLevel extends bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedLevel.$Properties {
                    }

                    /** Represents a PlayerDanmakuAiRecommendedLevel. */
                    class PlayerDanmakuAiRecommendedLevel {

                        /**
                         * Constructs a new PlayerDanmakuAiRecommendedLevel.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedLevel.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** PlayerDanmakuAiRecommendedLevel value. */
                        value: boolean;

                        /**
                         * Creates a new PlayerDanmakuAiRecommendedLevel instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns PlayerDanmakuAiRecommendedLevel instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedLevel.$Shape): bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedLevel & bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedLevel.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedLevel.$Properties): bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedLevel;

                        /**
                         * Encodes the specified PlayerDanmakuAiRecommendedLevel message. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedLevel.verify|verify} messages.
                         * @param message PlayerDanmakuAiRecommendedLevel message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedLevel.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified PlayerDanmakuAiRecommendedLevel message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedLevel.verify|verify} messages.
                         * @param message PlayerDanmakuAiRecommendedLevel message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedLevel.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a PlayerDanmakuAiRecommendedLevel message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedLevel & bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedLevel.$Shape} PlayerDanmakuAiRecommendedLevel
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedLevel & bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedLevel.$Shape;

                        /**
                         * Decodes a PlayerDanmakuAiRecommendedLevel message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedLevel & bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedLevel.$Shape} PlayerDanmakuAiRecommendedLevel
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedLevel & bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedLevel.$Shape;

                        /**
                         * Verifies a PlayerDanmakuAiRecommendedLevel message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a PlayerDanmakuAiRecommendedLevel message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns PlayerDanmakuAiRecommendedLevel
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedLevel;

                        /**
                         * Creates a plain object from a PlayerDanmakuAiRecommendedLevel message. Also converts values to other types if specified.
                         * @param message PlayerDanmakuAiRecommendedLevel
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedLevel, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this PlayerDanmakuAiRecommendedLevel to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for PlayerDanmakuAiRecommendedLevel
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace PlayerDanmakuAiRecommendedLevel {

                        /** Properties of a PlayerDanmakuAiRecommendedLevel. */
                        interface $Properties {

                            /** PlayerDanmakuAiRecommendedLevel value */
                            value?: (boolean|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of a PlayerDanmakuAiRecommendedLevel. */
                        type $Shape = bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedLevel.$Properties;
                    }

                    /**
                     * Properties of a PlayerDanmakuAiRecommendedLevelV2.
                     * @deprecated Use bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedLevelV2.$Properties instead.
                     */
                    interface IPlayerDanmakuAiRecommendedLevelV2 extends bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedLevelV2.$Properties {
                    }

                    /** Represents a PlayerDanmakuAiRecommendedLevelV2. */
                    class PlayerDanmakuAiRecommendedLevelV2 {

                        /**
                         * Constructs a new PlayerDanmakuAiRecommendedLevelV2.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedLevelV2.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** PlayerDanmakuAiRecommendedLevelV2 value. */
                        value: number;

                        /**
                         * Creates a new PlayerDanmakuAiRecommendedLevelV2 instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns PlayerDanmakuAiRecommendedLevelV2 instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedLevelV2.$Shape): bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedLevelV2 & bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedLevelV2.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedLevelV2.$Properties): bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedLevelV2;

                        /**
                         * Encodes the specified PlayerDanmakuAiRecommendedLevelV2 message. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedLevelV2.verify|verify} messages.
                         * @param message PlayerDanmakuAiRecommendedLevelV2 message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedLevelV2.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified PlayerDanmakuAiRecommendedLevelV2 message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedLevelV2.verify|verify} messages.
                         * @param message PlayerDanmakuAiRecommendedLevelV2 message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedLevelV2.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a PlayerDanmakuAiRecommendedLevelV2 message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedLevelV2 & bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedLevelV2.$Shape} PlayerDanmakuAiRecommendedLevelV2
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedLevelV2 & bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedLevelV2.$Shape;

                        /**
                         * Decodes a PlayerDanmakuAiRecommendedLevelV2 message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedLevelV2 & bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedLevelV2.$Shape} PlayerDanmakuAiRecommendedLevelV2
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedLevelV2 & bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedLevelV2.$Shape;

                        /**
                         * Verifies a PlayerDanmakuAiRecommendedLevelV2 message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a PlayerDanmakuAiRecommendedLevelV2 message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns PlayerDanmakuAiRecommendedLevelV2
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedLevelV2;

                        /**
                         * Creates a plain object from a PlayerDanmakuAiRecommendedLevelV2 message. Also converts values to other types if specified.
                         * @param message PlayerDanmakuAiRecommendedLevelV2
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedLevelV2, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this PlayerDanmakuAiRecommendedLevelV2 to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for PlayerDanmakuAiRecommendedLevelV2
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace PlayerDanmakuAiRecommendedLevelV2 {

                        /** Properties of a PlayerDanmakuAiRecommendedLevelV2. */
                        interface $Properties {

                            /** PlayerDanmakuAiRecommendedLevelV2 value */
                            value?: (number|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of a PlayerDanmakuAiRecommendedLevelV2. */
                        type $Shape = bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedLevelV2.$Properties;
                    }

                    /**
                     * Properties of a PlayerDanmakuAiRecommendedSwitch.
                     * @deprecated Use bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedSwitch.$Properties instead.
                     */
                    interface IPlayerDanmakuAiRecommendedSwitch extends bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedSwitch.$Properties {
                    }

                    /** Represents a PlayerDanmakuAiRecommendedSwitch. */
                    class PlayerDanmakuAiRecommendedSwitch {

                        /**
                         * Constructs a new PlayerDanmakuAiRecommendedSwitch.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedSwitch.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** PlayerDanmakuAiRecommendedSwitch value. */
                        value: boolean;

                        /**
                         * Creates a new PlayerDanmakuAiRecommendedSwitch instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns PlayerDanmakuAiRecommendedSwitch instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedSwitch.$Shape): bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedSwitch & bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedSwitch.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedSwitch.$Properties): bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedSwitch;

                        /**
                         * Encodes the specified PlayerDanmakuAiRecommendedSwitch message. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedSwitch.verify|verify} messages.
                         * @param message PlayerDanmakuAiRecommendedSwitch message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedSwitch.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified PlayerDanmakuAiRecommendedSwitch message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedSwitch.verify|verify} messages.
                         * @param message PlayerDanmakuAiRecommendedSwitch message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedSwitch.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a PlayerDanmakuAiRecommendedSwitch message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedSwitch & bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedSwitch.$Shape} PlayerDanmakuAiRecommendedSwitch
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedSwitch & bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedSwitch.$Shape;

                        /**
                         * Decodes a PlayerDanmakuAiRecommendedSwitch message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedSwitch & bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedSwitch.$Shape} PlayerDanmakuAiRecommendedSwitch
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedSwitch & bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedSwitch.$Shape;

                        /**
                         * Verifies a PlayerDanmakuAiRecommendedSwitch message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a PlayerDanmakuAiRecommendedSwitch message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns PlayerDanmakuAiRecommendedSwitch
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedSwitch;

                        /**
                         * Creates a plain object from a PlayerDanmakuAiRecommendedSwitch message. Also converts values to other types if specified.
                         * @param message PlayerDanmakuAiRecommendedSwitch
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedSwitch, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this PlayerDanmakuAiRecommendedSwitch to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for PlayerDanmakuAiRecommendedSwitch
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace PlayerDanmakuAiRecommendedSwitch {

                        /** Properties of a PlayerDanmakuAiRecommendedSwitch. */
                        interface $Properties {

                            /** PlayerDanmakuAiRecommendedSwitch value */
                            value?: (boolean|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of a PlayerDanmakuAiRecommendedSwitch. */
                        type $Shape = bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedSwitch.$Properties;
                    }

                    /**
                     * Properties of a PlayerDanmakuBlockbottom.
                     * @deprecated Use bilibili.community.service.dm.v1.PlayerDanmakuBlockbottom.$Properties instead.
                     */
                    interface IPlayerDanmakuBlockbottom extends bilibili.community.service.dm.v1.PlayerDanmakuBlockbottom.$Properties {
                    }

                    /** Represents a PlayerDanmakuBlockbottom. */
                    class PlayerDanmakuBlockbottom {

                        /**
                         * Constructs a new PlayerDanmakuBlockbottom.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.PlayerDanmakuBlockbottom.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** PlayerDanmakuBlockbottom value. */
                        value: boolean;

                        /**
                         * Creates a new PlayerDanmakuBlockbottom instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns PlayerDanmakuBlockbottom instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.PlayerDanmakuBlockbottom.$Shape): bilibili.community.service.dm.v1.PlayerDanmakuBlockbottom & bilibili.community.service.dm.v1.PlayerDanmakuBlockbottom.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.PlayerDanmakuBlockbottom.$Properties): bilibili.community.service.dm.v1.PlayerDanmakuBlockbottom;

                        /**
                         * Encodes the specified PlayerDanmakuBlockbottom message. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuBlockbottom.verify|verify} messages.
                         * @param message PlayerDanmakuBlockbottom message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.PlayerDanmakuBlockbottom.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified PlayerDanmakuBlockbottom message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuBlockbottom.verify|verify} messages.
                         * @param message PlayerDanmakuBlockbottom message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.PlayerDanmakuBlockbottom.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a PlayerDanmakuBlockbottom message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.PlayerDanmakuBlockbottom & bilibili.community.service.dm.v1.PlayerDanmakuBlockbottom.$Shape} PlayerDanmakuBlockbottom
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.PlayerDanmakuBlockbottom & bilibili.community.service.dm.v1.PlayerDanmakuBlockbottom.$Shape;

                        /**
                         * Decodes a PlayerDanmakuBlockbottom message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.PlayerDanmakuBlockbottom & bilibili.community.service.dm.v1.PlayerDanmakuBlockbottom.$Shape} PlayerDanmakuBlockbottom
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.PlayerDanmakuBlockbottom & bilibili.community.service.dm.v1.PlayerDanmakuBlockbottom.$Shape;

                        /**
                         * Verifies a PlayerDanmakuBlockbottom message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a PlayerDanmakuBlockbottom message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns PlayerDanmakuBlockbottom
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.PlayerDanmakuBlockbottom;

                        /**
                         * Creates a plain object from a PlayerDanmakuBlockbottom message. Also converts values to other types if specified.
                         * @param message PlayerDanmakuBlockbottom
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.PlayerDanmakuBlockbottom, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this PlayerDanmakuBlockbottom to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for PlayerDanmakuBlockbottom
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace PlayerDanmakuBlockbottom {

                        /** Properties of a PlayerDanmakuBlockbottom. */
                        interface $Properties {

                            /** PlayerDanmakuBlockbottom value */
                            value?: (boolean|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of a PlayerDanmakuBlockbottom. */
                        type $Shape = bilibili.community.service.dm.v1.PlayerDanmakuBlockbottom.$Properties;
                    }

                    /**
                     * Properties of a PlayerDanmakuBlockcolorful.
                     * @deprecated Use bilibili.community.service.dm.v1.PlayerDanmakuBlockcolorful.$Properties instead.
                     */
                    interface IPlayerDanmakuBlockcolorful extends bilibili.community.service.dm.v1.PlayerDanmakuBlockcolorful.$Properties {
                    }

                    /** Represents a PlayerDanmakuBlockcolorful. */
                    class PlayerDanmakuBlockcolorful {

                        /**
                         * Constructs a new PlayerDanmakuBlockcolorful.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.PlayerDanmakuBlockcolorful.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** PlayerDanmakuBlockcolorful value. */
                        value: boolean;

                        /**
                         * Creates a new PlayerDanmakuBlockcolorful instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns PlayerDanmakuBlockcolorful instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.PlayerDanmakuBlockcolorful.$Shape): bilibili.community.service.dm.v1.PlayerDanmakuBlockcolorful & bilibili.community.service.dm.v1.PlayerDanmakuBlockcolorful.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.PlayerDanmakuBlockcolorful.$Properties): bilibili.community.service.dm.v1.PlayerDanmakuBlockcolorful;

                        /**
                         * Encodes the specified PlayerDanmakuBlockcolorful message. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuBlockcolorful.verify|verify} messages.
                         * @param message PlayerDanmakuBlockcolorful message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.PlayerDanmakuBlockcolorful.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified PlayerDanmakuBlockcolorful message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuBlockcolorful.verify|verify} messages.
                         * @param message PlayerDanmakuBlockcolorful message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.PlayerDanmakuBlockcolorful.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a PlayerDanmakuBlockcolorful message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.PlayerDanmakuBlockcolorful & bilibili.community.service.dm.v1.PlayerDanmakuBlockcolorful.$Shape} PlayerDanmakuBlockcolorful
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.PlayerDanmakuBlockcolorful & bilibili.community.service.dm.v1.PlayerDanmakuBlockcolorful.$Shape;

                        /**
                         * Decodes a PlayerDanmakuBlockcolorful message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.PlayerDanmakuBlockcolorful & bilibili.community.service.dm.v1.PlayerDanmakuBlockcolorful.$Shape} PlayerDanmakuBlockcolorful
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.PlayerDanmakuBlockcolorful & bilibili.community.service.dm.v1.PlayerDanmakuBlockcolorful.$Shape;

                        /**
                         * Verifies a PlayerDanmakuBlockcolorful message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a PlayerDanmakuBlockcolorful message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns PlayerDanmakuBlockcolorful
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.PlayerDanmakuBlockcolorful;

                        /**
                         * Creates a plain object from a PlayerDanmakuBlockcolorful message. Also converts values to other types if specified.
                         * @param message PlayerDanmakuBlockcolorful
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.PlayerDanmakuBlockcolorful, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this PlayerDanmakuBlockcolorful to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for PlayerDanmakuBlockcolorful
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace PlayerDanmakuBlockcolorful {

                        /** Properties of a PlayerDanmakuBlockcolorful. */
                        interface $Properties {

                            /** PlayerDanmakuBlockcolorful value */
                            value?: (boolean|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of a PlayerDanmakuBlockcolorful. */
                        type $Shape = bilibili.community.service.dm.v1.PlayerDanmakuBlockcolorful.$Properties;
                    }

                    /**
                     * Properties of a PlayerDanmakuBlockrepeat.
                     * @deprecated Use bilibili.community.service.dm.v1.PlayerDanmakuBlockrepeat.$Properties instead.
                     */
                    interface IPlayerDanmakuBlockrepeat extends bilibili.community.service.dm.v1.PlayerDanmakuBlockrepeat.$Properties {
                    }

                    /** Represents a PlayerDanmakuBlockrepeat. */
                    class PlayerDanmakuBlockrepeat {

                        /**
                         * Constructs a new PlayerDanmakuBlockrepeat.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.PlayerDanmakuBlockrepeat.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** PlayerDanmakuBlockrepeat value. */
                        value: boolean;

                        /**
                         * Creates a new PlayerDanmakuBlockrepeat instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns PlayerDanmakuBlockrepeat instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.PlayerDanmakuBlockrepeat.$Shape): bilibili.community.service.dm.v1.PlayerDanmakuBlockrepeat & bilibili.community.service.dm.v1.PlayerDanmakuBlockrepeat.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.PlayerDanmakuBlockrepeat.$Properties): bilibili.community.service.dm.v1.PlayerDanmakuBlockrepeat;

                        /**
                         * Encodes the specified PlayerDanmakuBlockrepeat message. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuBlockrepeat.verify|verify} messages.
                         * @param message PlayerDanmakuBlockrepeat message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.PlayerDanmakuBlockrepeat.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified PlayerDanmakuBlockrepeat message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuBlockrepeat.verify|verify} messages.
                         * @param message PlayerDanmakuBlockrepeat message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.PlayerDanmakuBlockrepeat.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a PlayerDanmakuBlockrepeat message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.PlayerDanmakuBlockrepeat & bilibili.community.service.dm.v1.PlayerDanmakuBlockrepeat.$Shape} PlayerDanmakuBlockrepeat
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.PlayerDanmakuBlockrepeat & bilibili.community.service.dm.v1.PlayerDanmakuBlockrepeat.$Shape;

                        /**
                         * Decodes a PlayerDanmakuBlockrepeat message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.PlayerDanmakuBlockrepeat & bilibili.community.service.dm.v1.PlayerDanmakuBlockrepeat.$Shape} PlayerDanmakuBlockrepeat
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.PlayerDanmakuBlockrepeat & bilibili.community.service.dm.v1.PlayerDanmakuBlockrepeat.$Shape;

                        /**
                         * Verifies a PlayerDanmakuBlockrepeat message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a PlayerDanmakuBlockrepeat message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns PlayerDanmakuBlockrepeat
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.PlayerDanmakuBlockrepeat;

                        /**
                         * Creates a plain object from a PlayerDanmakuBlockrepeat message. Also converts values to other types if specified.
                         * @param message PlayerDanmakuBlockrepeat
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.PlayerDanmakuBlockrepeat, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this PlayerDanmakuBlockrepeat to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for PlayerDanmakuBlockrepeat
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace PlayerDanmakuBlockrepeat {

                        /** Properties of a PlayerDanmakuBlockrepeat. */
                        interface $Properties {

                            /** PlayerDanmakuBlockrepeat value */
                            value?: (boolean|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of a PlayerDanmakuBlockrepeat. */
                        type $Shape = bilibili.community.service.dm.v1.PlayerDanmakuBlockrepeat.$Properties;
                    }

                    /**
                     * Properties of a PlayerDanmakuBlockscroll.
                     * @deprecated Use bilibili.community.service.dm.v1.PlayerDanmakuBlockscroll.$Properties instead.
                     */
                    interface IPlayerDanmakuBlockscroll extends bilibili.community.service.dm.v1.PlayerDanmakuBlockscroll.$Properties {
                    }

                    /** Represents a PlayerDanmakuBlockscroll. */
                    class PlayerDanmakuBlockscroll {

                        /**
                         * Constructs a new PlayerDanmakuBlockscroll.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.PlayerDanmakuBlockscroll.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** PlayerDanmakuBlockscroll value. */
                        value: boolean;

                        /**
                         * Creates a new PlayerDanmakuBlockscroll instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns PlayerDanmakuBlockscroll instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.PlayerDanmakuBlockscroll.$Shape): bilibili.community.service.dm.v1.PlayerDanmakuBlockscroll & bilibili.community.service.dm.v1.PlayerDanmakuBlockscroll.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.PlayerDanmakuBlockscroll.$Properties): bilibili.community.service.dm.v1.PlayerDanmakuBlockscroll;

                        /**
                         * Encodes the specified PlayerDanmakuBlockscroll message. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuBlockscroll.verify|verify} messages.
                         * @param message PlayerDanmakuBlockscroll message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.PlayerDanmakuBlockscroll.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified PlayerDanmakuBlockscroll message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuBlockscroll.verify|verify} messages.
                         * @param message PlayerDanmakuBlockscroll message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.PlayerDanmakuBlockscroll.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a PlayerDanmakuBlockscroll message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.PlayerDanmakuBlockscroll & bilibili.community.service.dm.v1.PlayerDanmakuBlockscroll.$Shape} PlayerDanmakuBlockscroll
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.PlayerDanmakuBlockscroll & bilibili.community.service.dm.v1.PlayerDanmakuBlockscroll.$Shape;

                        /**
                         * Decodes a PlayerDanmakuBlockscroll message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.PlayerDanmakuBlockscroll & bilibili.community.service.dm.v1.PlayerDanmakuBlockscroll.$Shape} PlayerDanmakuBlockscroll
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.PlayerDanmakuBlockscroll & bilibili.community.service.dm.v1.PlayerDanmakuBlockscroll.$Shape;

                        /**
                         * Verifies a PlayerDanmakuBlockscroll message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a PlayerDanmakuBlockscroll message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns PlayerDanmakuBlockscroll
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.PlayerDanmakuBlockscroll;

                        /**
                         * Creates a plain object from a PlayerDanmakuBlockscroll message. Also converts values to other types if specified.
                         * @param message PlayerDanmakuBlockscroll
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.PlayerDanmakuBlockscroll, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this PlayerDanmakuBlockscroll to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for PlayerDanmakuBlockscroll
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace PlayerDanmakuBlockscroll {

                        /** Properties of a PlayerDanmakuBlockscroll. */
                        interface $Properties {

                            /** PlayerDanmakuBlockscroll value */
                            value?: (boolean|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of a PlayerDanmakuBlockscroll. */
                        type $Shape = bilibili.community.service.dm.v1.PlayerDanmakuBlockscroll.$Properties;
                    }

                    /**
                     * Properties of a PlayerDanmakuBlockspecial.
                     * @deprecated Use bilibili.community.service.dm.v1.PlayerDanmakuBlockspecial.$Properties instead.
                     */
                    interface IPlayerDanmakuBlockspecial extends bilibili.community.service.dm.v1.PlayerDanmakuBlockspecial.$Properties {
                    }

                    /** Represents a PlayerDanmakuBlockspecial. */
                    class PlayerDanmakuBlockspecial {

                        /**
                         * Constructs a new PlayerDanmakuBlockspecial.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.PlayerDanmakuBlockspecial.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** PlayerDanmakuBlockspecial value. */
                        value: boolean;

                        /**
                         * Creates a new PlayerDanmakuBlockspecial instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns PlayerDanmakuBlockspecial instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.PlayerDanmakuBlockspecial.$Shape): bilibili.community.service.dm.v1.PlayerDanmakuBlockspecial & bilibili.community.service.dm.v1.PlayerDanmakuBlockspecial.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.PlayerDanmakuBlockspecial.$Properties): bilibili.community.service.dm.v1.PlayerDanmakuBlockspecial;

                        /**
                         * Encodes the specified PlayerDanmakuBlockspecial message. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuBlockspecial.verify|verify} messages.
                         * @param message PlayerDanmakuBlockspecial message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.PlayerDanmakuBlockspecial.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified PlayerDanmakuBlockspecial message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuBlockspecial.verify|verify} messages.
                         * @param message PlayerDanmakuBlockspecial message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.PlayerDanmakuBlockspecial.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a PlayerDanmakuBlockspecial message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.PlayerDanmakuBlockspecial & bilibili.community.service.dm.v1.PlayerDanmakuBlockspecial.$Shape} PlayerDanmakuBlockspecial
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.PlayerDanmakuBlockspecial & bilibili.community.service.dm.v1.PlayerDanmakuBlockspecial.$Shape;

                        /**
                         * Decodes a PlayerDanmakuBlockspecial message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.PlayerDanmakuBlockspecial & bilibili.community.service.dm.v1.PlayerDanmakuBlockspecial.$Shape} PlayerDanmakuBlockspecial
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.PlayerDanmakuBlockspecial & bilibili.community.service.dm.v1.PlayerDanmakuBlockspecial.$Shape;

                        /**
                         * Verifies a PlayerDanmakuBlockspecial message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a PlayerDanmakuBlockspecial message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns PlayerDanmakuBlockspecial
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.PlayerDanmakuBlockspecial;

                        /**
                         * Creates a plain object from a PlayerDanmakuBlockspecial message. Also converts values to other types if specified.
                         * @param message PlayerDanmakuBlockspecial
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.PlayerDanmakuBlockspecial, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this PlayerDanmakuBlockspecial to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for PlayerDanmakuBlockspecial
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace PlayerDanmakuBlockspecial {

                        /** Properties of a PlayerDanmakuBlockspecial. */
                        interface $Properties {

                            /** PlayerDanmakuBlockspecial value */
                            value?: (boolean|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of a PlayerDanmakuBlockspecial. */
                        type $Shape = bilibili.community.service.dm.v1.PlayerDanmakuBlockspecial.$Properties;
                    }

                    /**
                     * Properties of a PlayerDanmakuBlocktop.
                     * @deprecated Use bilibili.community.service.dm.v1.PlayerDanmakuBlocktop.$Properties instead.
                     */
                    interface IPlayerDanmakuBlocktop extends bilibili.community.service.dm.v1.PlayerDanmakuBlocktop.$Properties {
                    }

                    /** Represents a PlayerDanmakuBlocktop. */
                    class PlayerDanmakuBlocktop {

                        /**
                         * Constructs a new PlayerDanmakuBlocktop.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.PlayerDanmakuBlocktop.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** PlayerDanmakuBlocktop value. */
                        value: boolean;

                        /**
                         * Creates a new PlayerDanmakuBlocktop instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns PlayerDanmakuBlocktop instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.PlayerDanmakuBlocktop.$Shape): bilibili.community.service.dm.v1.PlayerDanmakuBlocktop & bilibili.community.service.dm.v1.PlayerDanmakuBlocktop.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.PlayerDanmakuBlocktop.$Properties): bilibili.community.service.dm.v1.PlayerDanmakuBlocktop;

                        /**
                         * Encodes the specified PlayerDanmakuBlocktop message. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuBlocktop.verify|verify} messages.
                         * @param message PlayerDanmakuBlocktop message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.PlayerDanmakuBlocktop.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified PlayerDanmakuBlocktop message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuBlocktop.verify|verify} messages.
                         * @param message PlayerDanmakuBlocktop message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.PlayerDanmakuBlocktop.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a PlayerDanmakuBlocktop message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.PlayerDanmakuBlocktop & bilibili.community.service.dm.v1.PlayerDanmakuBlocktop.$Shape} PlayerDanmakuBlocktop
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.PlayerDanmakuBlocktop & bilibili.community.service.dm.v1.PlayerDanmakuBlocktop.$Shape;

                        /**
                         * Decodes a PlayerDanmakuBlocktop message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.PlayerDanmakuBlocktop & bilibili.community.service.dm.v1.PlayerDanmakuBlocktop.$Shape} PlayerDanmakuBlocktop
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.PlayerDanmakuBlocktop & bilibili.community.service.dm.v1.PlayerDanmakuBlocktop.$Shape;

                        /**
                         * Verifies a PlayerDanmakuBlocktop message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a PlayerDanmakuBlocktop message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns PlayerDanmakuBlocktop
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.PlayerDanmakuBlocktop;

                        /**
                         * Creates a plain object from a PlayerDanmakuBlocktop message. Also converts values to other types if specified.
                         * @param message PlayerDanmakuBlocktop
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.PlayerDanmakuBlocktop, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this PlayerDanmakuBlocktop to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for PlayerDanmakuBlocktop
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace PlayerDanmakuBlocktop {

                        /** Properties of a PlayerDanmakuBlocktop. */
                        interface $Properties {

                            /** PlayerDanmakuBlocktop value */
                            value?: (boolean|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of a PlayerDanmakuBlocktop. */
                        type $Shape = bilibili.community.service.dm.v1.PlayerDanmakuBlocktop.$Properties;
                    }

                    /**
                     * Properties of a PlayerDanmakuDomain.
                     * @deprecated Use bilibili.community.service.dm.v1.PlayerDanmakuDomain.$Properties instead.
                     */
                    interface IPlayerDanmakuDomain extends bilibili.community.service.dm.v1.PlayerDanmakuDomain.$Properties {
                    }

                    /** Represents a PlayerDanmakuDomain. */
                    class PlayerDanmakuDomain {

                        /**
                         * Constructs a new PlayerDanmakuDomain.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.PlayerDanmakuDomain.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** PlayerDanmakuDomain value. */
                        value: number;

                        /**
                         * Creates a new PlayerDanmakuDomain instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns PlayerDanmakuDomain instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.PlayerDanmakuDomain.$Shape): bilibili.community.service.dm.v1.PlayerDanmakuDomain & bilibili.community.service.dm.v1.PlayerDanmakuDomain.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.PlayerDanmakuDomain.$Properties): bilibili.community.service.dm.v1.PlayerDanmakuDomain;

                        /**
                         * Encodes the specified PlayerDanmakuDomain message. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuDomain.verify|verify} messages.
                         * @param message PlayerDanmakuDomain message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.PlayerDanmakuDomain.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified PlayerDanmakuDomain message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuDomain.verify|verify} messages.
                         * @param message PlayerDanmakuDomain message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.PlayerDanmakuDomain.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a PlayerDanmakuDomain message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.PlayerDanmakuDomain & bilibili.community.service.dm.v1.PlayerDanmakuDomain.$Shape} PlayerDanmakuDomain
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.PlayerDanmakuDomain & bilibili.community.service.dm.v1.PlayerDanmakuDomain.$Shape;

                        /**
                         * Decodes a PlayerDanmakuDomain message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.PlayerDanmakuDomain & bilibili.community.service.dm.v1.PlayerDanmakuDomain.$Shape} PlayerDanmakuDomain
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.PlayerDanmakuDomain & bilibili.community.service.dm.v1.PlayerDanmakuDomain.$Shape;

                        /**
                         * Verifies a PlayerDanmakuDomain message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a PlayerDanmakuDomain message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns PlayerDanmakuDomain
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.PlayerDanmakuDomain;

                        /**
                         * Creates a plain object from a PlayerDanmakuDomain message. Also converts values to other types if specified.
                         * @param message PlayerDanmakuDomain
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.PlayerDanmakuDomain, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this PlayerDanmakuDomain to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for PlayerDanmakuDomain
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace PlayerDanmakuDomain {

                        /** Properties of a PlayerDanmakuDomain. */
                        interface $Properties {

                            /** PlayerDanmakuDomain value */
                            value?: (number|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of a PlayerDanmakuDomain. */
                        type $Shape = bilibili.community.service.dm.v1.PlayerDanmakuDomain.$Properties;
                    }

                    /**
                     * Properties of a PlayerDanmakuEnableblocklist.
                     * @deprecated Use bilibili.community.service.dm.v1.PlayerDanmakuEnableblocklist.$Properties instead.
                     */
                    interface IPlayerDanmakuEnableblocklist extends bilibili.community.service.dm.v1.PlayerDanmakuEnableblocklist.$Properties {
                    }

                    /** Represents a PlayerDanmakuEnableblocklist. */
                    class PlayerDanmakuEnableblocklist {

                        /**
                         * Constructs a new PlayerDanmakuEnableblocklist.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.PlayerDanmakuEnableblocklist.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** PlayerDanmakuEnableblocklist value. */
                        value: boolean;

                        /**
                         * Creates a new PlayerDanmakuEnableblocklist instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns PlayerDanmakuEnableblocklist instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.PlayerDanmakuEnableblocklist.$Shape): bilibili.community.service.dm.v1.PlayerDanmakuEnableblocklist & bilibili.community.service.dm.v1.PlayerDanmakuEnableblocklist.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.PlayerDanmakuEnableblocklist.$Properties): bilibili.community.service.dm.v1.PlayerDanmakuEnableblocklist;

                        /**
                         * Encodes the specified PlayerDanmakuEnableblocklist message. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuEnableblocklist.verify|verify} messages.
                         * @param message PlayerDanmakuEnableblocklist message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.PlayerDanmakuEnableblocklist.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified PlayerDanmakuEnableblocklist message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuEnableblocklist.verify|verify} messages.
                         * @param message PlayerDanmakuEnableblocklist message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.PlayerDanmakuEnableblocklist.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a PlayerDanmakuEnableblocklist message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.PlayerDanmakuEnableblocklist & bilibili.community.service.dm.v1.PlayerDanmakuEnableblocklist.$Shape} PlayerDanmakuEnableblocklist
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.PlayerDanmakuEnableblocklist & bilibili.community.service.dm.v1.PlayerDanmakuEnableblocklist.$Shape;

                        /**
                         * Decodes a PlayerDanmakuEnableblocklist message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.PlayerDanmakuEnableblocklist & bilibili.community.service.dm.v1.PlayerDanmakuEnableblocklist.$Shape} PlayerDanmakuEnableblocklist
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.PlayerDanmakuEnableblocklist & bilibili.community.service.dm.v1.PlayerDanmakuEnableblocklist.$Shape;

                        /**
                         * Verifies a PlayerDanmakuEnableblocklist message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a PlayerDanmakuEnableblocklist message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns PlayerDanmakuEnableblocklist
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.PlayerDanmakuEnableblocklist;

                        /**
                         * Creates a plain object from a PlayerDanmakuEnableblocklist message. Also converts values to other types if specified.
                         * @param message PlayerDanmakuEnableblocklist
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.PlayerDanmakuEnableblocklist, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this PlayerDanmakuEnableblocklist to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for PlayerDanmakuEnableblocklist
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace PlayerDanmakuEnableblocklist {

                        /** Properties of a PlayerDanmakuEnableblocklist. */
                        interface $Properties {

                            /** PlayerDanmakuEnableblocklist value */
                            value?: (boolean|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of a PlayerDanmakuEnableblocklist. */
                        type $Shape = bilibili.community.service.dm.v1.PlayerDanmakuEnableblocklist.$Properties;
                    }

                    /**
                     * Properties of a PlayerDanmakuOpacity.
                     * @deprecated Use bilibili.community.service.dm.v1.PlayerDanmakuOpacity.$Properties instead.
                     */
                    interface IPlayerDanmakuOpacity extends bilibili.community.service.dm.v1.PlayerDanmakuOpacity.$Properties {
                    }

                    /** Represents a PlayerDanmakuOpacity. */
                    class PlayerDanmakuOpacity {

                        /**
                         * Constructs a new PlayerDanmakuOpacity.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.PlayerDanmakuOpacity.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** PlayerDanmakuOpacity value. */
                        value: number;

                        /**
                         * Creates a new PlayerDanmakuOpacity instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns PlayerDanmakuOpacity instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.PlayerDanmakuOpacity.$Shape): bilibili.community.service.dm.v1.PlayerDanmakuOpacity & bilibili.community.service.dm.v1.PlayerDanmakuOpacity.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.PlayerDanmakuOpacity.$Properties): bilibili.community.service.dm.v1.PlayerDanmakuOpacity;

                        /**
                         * Encodes the specified PlayerDanmakuOpacity message. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuOpacity.verify|verify} messages.
                         * @param message PlayerDanmakuOpacity message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.PlayerDanmakuOpacity.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified PlayerDanmakuOpacity message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuOpacity.verify|verify} messages.
                         * @param message PlayerDanmakuOpacity message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.PlayerDanmakuOpacity.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a PlayerDanmakuOpacity message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.PlayerDanmakuOpacity & bilibili.community.service.dm.v1.PlayerDanmakuOpacity.$Shape} PlayerDanmakuOpacity
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.PlayerDanmakuOpacity & bilibili.community.service.dm.v1.PlayerDanmakuOpacity.$Shape;

                        /**
                         * Decodes a PlayerDanmakuOpacity message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.PlayerDanmakuOpacity & bilibili.community.service.dm.v1.PlayerDanmakuOpacity.$Shape} PlayerDanmakuOpacity
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.PlayerDanmakuOpacity & bilibili.community.service.dm.v1.PlayerDanmakuOpacity.$Shape;

                        /**
                         * Verifies a PlayerDanmakuOpacity message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a PlayerDanmakuOpacity message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns PlayerDanmakuOpacity
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.PlayerDanmakuOpacity;

                        /**
                         * Creates a plain object from a PlayerDanmakuOpacity message. Also converts values to other types if specified.
                         * @param message PlayerDanmakuOpacity
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.PlayerDanmakuOpacity, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this PlayerDanmakuOpacity to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for PlayerDanmakuOpacity
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace PlayerDanmakuOpacity {

                        /** Properties of a PlayerDanmakuOpacity. */
                        interface $Properties {

                            /** PlayerDanmakuOpacity value */
                            value?: (number|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of a PlayerDanmakuOpacity. */
                        type $Shape = bilibili.community.service.dm.v1.PlayerDanmakuOpacity.$Properties;
                    }

                    /**
                     * Properties of a PlayerDanmakuScalingfactor.
                     * @deprecated Use bilibili.community.service.dm.v1.PlayerDanmakuScalingfactor.$Properties instead.
                     */
                    interface IPlayerDanmakuScalingfactor extends bilibili.community.service.dm.v1.PlayerDanmakuScalingfactor.$Properties {
                    }

                    /** Represents a PlayerDanmakuScalingfactor. */
                    class PlayerDanmakuScalingfactor {

                        /**
                         * Constructs a new PlayerDanmakuScalingfactor.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.PlayerDanmakuScalingfactor.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** PlayerDanmakuScalingfactor value. */
                        value: number;

                        /**
                         * Creates a new PlayerDanmakuScalingfactor instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns PlayerDanmakuScalingfactor instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.PlayerDanmakuScalingfactor.$Shape): bilibili.community.service.dm.v1.PlayerDanmakuScalingfactor & bilibili.community.service.dm.v1.PlayerDanmakuScalingfactor.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.PlayerDanmakuScalingfactor.$Properties): bilibili.community.service.dm.v1.PlayerDanmakuScalingfactor;

                        /**
                         * Encodes the specified PlayerDanmakuScalingfactor message. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuScalingfactor.verify|verify} messages.
                         * @param message PlayerDanmakuScalingfactor message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.PlayerDanmakuScalingfactor.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified PlayerDanmakuScalingfactor message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuScalingfactor.verify|verify} messages.
                         * @param message PlayerDanmakuScalingfactor message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.PlayerDanmakuScalingfactor.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a PlayerDanmakuScalingfactor message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.PlayerDanmakuScalingfactor & bilibili.community.service.dm.v1.PlayerDanmakuScalingfactor.$Shape} PlayerDanmakuScalingfactor
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.PlayerDanmakuScalingfactor & bilibili.community.service.dm.v1.PlayerDanmakuScalingfactor.$Shape;

                        /**
                         * Decodes a PlayerDanmakuScalingfactor message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.PlayerDanmakuScalingfactor & bilibili.community.service.dm.v1.PlayerDanmakuScalingfactor.$Shape} PlayerDanmakuScalingfactor
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.PlayerDanmakuScalingfactor & bilibili.community.service.dm.v1.PlayerDanmakuScalingfactor.$Shape;

                        /**
                         * Verifies a PlayerDanmakuScalingfactor message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a PlayerDanmakuScalingfactor message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns PlayerDanmakuScalingfactor
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.PlayerDanmakuScalingfactor;

                        /**
                         * Creates a plain object from a PlayerDanmakuScalingfactor message. Also converts values to other types if specified.
                         * @param message PlayerDanmakuScalingfactor
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.PlayerDanmakuScalingfactor, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this PlayerDanmakuScalingfactor to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for PlayerDanmakuScalingfactor
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace PlayerDanmakuScalingfactor {

                        /** Properties of a PlayerDanmakuScalingfactor. */
                        interface $Properties {

                            /** PlayerDanmakuScalingfactor value */
                            value?: (number|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of a PlayerDanmakuScalingfactor. */
                        type $Shape = bilibili.community.service.dm.v1.PlayerDanmakuScalingfactor.$Properties;
                    }

                    /**
                     * Properties of a PlayerDanmakuSeniorModeSwitch.
                     * @deprecated Use bilibili.community.service.dm.v1.PlayerDanmakuSeniorModeSwitch.$Properties instead.
                     */
                    interface IPlayerDanmakuSeniorModeSwitch extends bilibili.community.service.dm.v1.PlayerDanmakuSeniorModeSwitch.$Properties {
                    }

                    /** Represents a PlayerDanmakuSeniorModeSwitch. */
                    class PlayerDanmakuSeniorModeSwitch {

                        /**
                         * Constructs a new PlayerDanmakuSeniorModeSwitch.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.PlayerDanmakuSeniorModeSwitch.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** PlayerDanmakuSeniorModeSwitch value. */
                        value: number;

                        /**
                         * Creates a new PlayerDanmakuSeniorModeSwitch instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns PlayerDanmakuSeniorModeSwitch instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.PlayerDanmakuSeniorModeSwitch.$Shape): bilibili.community.service.dm.v1.PlayerDanmakuSeniorModeSwitch & bilibili.community.service.dm.v1.PlayerDanmakuSeniorModeSwitch.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.PlayerDanmakuSeniorModeSwitch.$Properties): bilibili.community.service.dm.v1.PlayerDanmakuSeniorModeSwitch;

                        /**
                         * Encodes the specified PlayerDanmakuSeniorModeSwitch message. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuSeniorModeSwitch.verify|verify} messages.
                         * @param message PlayerDanmakuSeniorModeSwitch message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.PlayerDanmakuSeniorModeSwitch.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified PlayerDanmakuSeniorModeSwitch message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuSeniorModeSwitch.verify|verify} messages.
                         * @param message PlayerDanmakuSeniorModeSwitch message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.PlayerDanmakuSeniorModeSwitch.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a PlayerDanmakuSeniorModeSwitch message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.PlayerDanmakuSeniorModeSwitch & bilibili.community.service.dm.v1.PlayerDanmakuSeniorModeSwitch.$Shape} PlayerDanmakuSeniorModeSwitch
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.PlayerDanmakuSeniorModeSwitch & bilibili.community.service.dm.v1.PlayerDanmakuSeniorModeSwitch.$Shape;

                        /**
                         * Decodes a PlayerDanmakuSeniorModeSwitch message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.PlayerDanmakuSeniorModeSwitch & bilibili.community.service.dm.v1.PlayerDanmakuSeniorModeSwitch.$Shape} PlayerDanmakuSeniorModeSwitch
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.PlayerDanmakuSeniorModeSwitch & bilibili.community.service.dm.v1.PlayerDanmakuSeniorModeSwitch.$Shape;

                        /**
                         * Verifies a PlayerDanmakuSeniorModeSwitch message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a PlayerDanmakuSeniorModeSwitch message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns PlayerDanmakuSeniorModeSwitch
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.PlayerDanmakuSeniorModeSwitch;

                        /**
                         * Creates a plain object from a PlayerDanmakuSeniorModeSwitch message. Also converts values to other types if specified.
                         * @param message PlayerDanmakuSeniorModeSwitch
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.PlayerDanmakuSeniorModeSwitch, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this PlayerDanmakuSeniorModeSwitch to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for PlayerDanmakuSeniorModeSwitch
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace PlayerDanmakuSeniorModeSwitch {

                        /** Properties of a PlayerDanmakuSeniorModeSwitch. */
                        interface $Properties {

                            /** PlayerDanmakuSeniorModeSwitch value */
                            value?: (number|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of a PlayerDanmakuSeniorModeSwitch. */
                        type $Shape = bilibili.community.service.dm.v1.PlayerDanmakuSeniorModeSwitch.$Properties;
                    }

                    /**
                     * Properties of a PlayerDanmakuSpeed.
                     * @deprecated Use bilibili.community.service.dm.v1.PlayerDanmakuSpeed.$Properties instead.
                     */
                    interface IPlayerDanmakuSpeed extends bilibili.community.service.dm.v1.PlayerDanmakuSpeed.$Properties {
                    }

                    /** Represents a PlayerDanmakuSpeed. */
                    class PlayerDanmakuSpeed {

                        /**
                         * Constructs a new PlayerDanmakuSpeed.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.PlayerDanmakuSpeed.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** PlayerDanmakuSpeed value. */
                        value: number;

                        /**
                         * Creates a new PlayerDanmakuSpeed instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns PlayerDanmakuSpeed instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.PlayerDanmakuSpeed.$Shape): bilibili.community.service.dm.v1.PlayerDanmakuSpeed & bilibili.community.service.dm.v1.PlayerDanmakuSpeed.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.PlayerDanmakuSpeed.$Properties): bilibili.community.service.dm.v1.PlayerDanmakuSpeed;

                        /**
                         * Encodes the specified PlayerDanmakuSpeed message. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuSpeed.verify|verify} messages.
                         * @param message PlayerDanmakuSpeed message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.PlayerDanmakuSpeed.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified PlayerDanmakuSpeed message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuSpeed.verify|verify} messages.
                         * @param message PlayerDanmakuSpeed message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.PlayerDanmakuSpeed.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a PlayerDanmakuSpeed message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.PlayerDanmakuSpeed & bilibili.community.service.dm.v1.PlayerDanmakuSpeed.$Shape} PlayerDanmakuSpeed
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.PlayerDanmakuSpeed & bilibili.community.service.dm.v1.PlayerDanmakuSpeed.$Shape;

                        /**
                         * Decodes a PlayerDanmakuSpeed message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.PlayerDanmakuSpeed & bilibili.community.service.dm.v1.PlayerDanmakuSpeed.$Shape} PlayerDanmakuSpeed
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.PlayerDanmakuSpeed & bilibili.community.service.dm.v1.PlayerDanmakuSpeed.$Shape;

                        /**
                         * Verifies a PlayerDanmakuSpeed message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a PlayerDanmakuSpeed message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns PlayerDanmakuSpeed
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.PlayerDanmakuSpeed;

                        /**
                         * Creates a plain object from a PlayerDanmakuSpeed message. Also converts values to other types if specified.
                         * @param message PlayerDanmakuSpeed
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.PlayerDanmakuSpeed, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this PlayerDanmakuSpeed to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for PlayerDanmakuSpeed
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace PlayerDanmakuSpeed {

                        /** Properties of a PlayerDanmakuSpeed. */
                        interface $Properties {

                            /** PlayerDanmakuSpeed value */
                            value?: (number|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of a PlayerDanmakuSpeed. */
                        type $Shape = bilibili.community.service.dm.v1.PlayerDanmakuSpeed.$Properties;
                    }

                    /**
                     * Properties of a PlayerDanmakuSwitch.
                     * @deprecated Use bilibili.community.service.dm.v1.PlayerDanmakuSwitch.$Properties instead.
                     */
                    interface IPlayerDanmakuSwitch extends bilibili.community.service.dm.v1.PlayerDanmakuSwitch.$Properties {
                    }

                    /** Represents a PlayerDanmakuSwitch. */
                    class PlayerDanmakuSwitch {

                        /**
                         * Constructs a new PlayerDanmakuSwitch.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.PlayerDanmakuSwitch.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** PlayerDanmakuSwitch value. */
                        value: boolean;

                        /** PlayerDanmakuSwitch canIgnore. */
                        canIgnore: boolean;

                        /**
                         * Creates a new PlayerDanmakuSwitch instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns PlayerDanmakuSwitch instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.PlayerDanmakuSwitch.$Shape): bilibili.community.service.dm.v1.PlayerDanmakuSwitch & bilibili.community.service.dm.v1.PlayerDanmakuSwitch.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.PlayerDanmakuSwitch.$Properties): bilibili.community.service.dm.v1.PlayerDanmakuSwitch;

                        /**
                         * Encodes the specified PlayerDanmakuSwitch message. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuSwitch.verify|verify} messages.
                         * @param message PlayerDanmakuSwitch message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.PlayerDanmakuSwitch.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified PlayerDanmakuSwitch message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuSwitch.verify|verify} messages.
                         * @param message PlayerDanmakuSwitch message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.PlayerDanmakuSwitch.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a PlayerDanmakuSwitch message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.PlayerDanmakuSwitch & bilibili.community.service.dm.v1.PlayerDanmakuSwitch.$Shape} PlayerDanmakuSwitch
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.PlayerDanmakuSwitch & bilibili.community.service.dm.v1.PlayerDanmakuSwitch.$Shape;

                        /**
                         * Decodes a PlayerDanmakuSwitch message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.PlayerDanmakuSwitch & bilibili.community.service.dm.v1.PlayerDanmakuSwitch.$Shape} PlayerDanmakuSwitch
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.PlayerDanmakuSwitch & bilibili.community.service.dm.v1.PlayerDanmakuSwitch.$Shape;

                        /**
                         * Verifies a PlayerDanmakuSwitch message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a PlayerDanmakuSwitch message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns PlayerDanmakuSwitch
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.PlayerDanmakuSwitch;

                        /**
                         * Creates a plain object from a PlayerDanmakuSwitch message. Also converts values to other types if specified.
                         * @param message PlayerDanmakuSwitch
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.PlayerDanmakuSwitch, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this PlayerDanmakuSwitch to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for PlayerDanmakuSwitch
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace PlayerDanmakuSwitch {

                        /** Properties of a PlayerDanmakuSwitch. */
                        interface $Properties {

                            /** PlayerDanmakuSwitch value */
                            value?: (boolean|null);

                            /** PlayerDanmakuSwitch canIgnore */
                            canIgnore?: (boolean|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of a PlayerDanmakuSwitch. */
                        type $Shape = bilibili.community.service.dm.v1.PlayerDanmakuSwitch.$Properties;
                    }

                    /**
                     * Properties of a PlayerDanmakuSwitchSave.
                     * @deprecated Use bilibili.community.service.dm.v1.PlayerDanmakuSwitchSave.$Properties instead.
                     */
                    interface IPlayerDanmakuSwitchSave extends bilibili.community.service.dm.v1.PlayerDanmakuSwitchSave.$Properties {
                    }

                    /** Represents a PlayerDanmakuSwitchSave. */
                    class PlayerDanmakuSwitchSave {

                        /**
                         * Constructs a new PlayerDanmakuSwitchSave.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.PlayerDanmakuSwitchSave.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** PlayerDanmakuSwitchSave value. */
                        value: boolean;

                        /**
                         * Creates a new PlayerDanmakuSwitchSave instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns PlayerDanmakuSwitchSave instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.PlayerDanmakuSwitchSave.$Shape): bilibili.community.service.dm.v1.PlayerDanmakuSwitchSave & bilibili.community.service.dm.v1.PlayerDanmakuSwitchSave.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.PlayerDanmakuSwitchSave.$Properties): bilibili.community.service.dm.v1.PlayerDanmakuSwitchSave;

                        /**
                         * Encodes the specified PlayerDanmakuSwitchSave message. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuSwitchSave.verify|verify} messages.
                         * @param message PlayerDanmakuSwitchSave message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.PlayerDanmakuSwitchSave.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified PlayerDanmakuSwitchSave message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuSwitchSave.verify|verify} messages.
                         * @param message PlayerDanmakuSwitchSave message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.PlayerDanmakuSwitchSave.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a PlayerDanmakuSwitchSave message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.PlayerDanmakuSwitchSave & bilibili.community.service.dm.v1.PlayerDanmakuSwitchSave.$Shape} PlayerDanmakuSwitchSave
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.PlayerDanmakuSwitchSave & bilibili.community.service.dm.v1.PlayerDanmakuSwitchSave.$Shape;

                        /**
                         * Decodes a PlayerDanmakuSwitchSave message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.PlayerDanmakuSwitchSave & bilibili.community.service.dm.v1.PlayerDanmakuSwitchSave.$Shape} PlayerDanmakuSwitchSave
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.PlayerDanmakuSwitchSave & bilibili.community.service.dm.v1.PlayerDanmakuSwitchSave.$Shape;

                        /**
                         * Verifies a PlayerDanmakuSwitchSave message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a PlayerDanmakuSwitchSave message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns PlayerDanmakuSwitchSave
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.PlayerDanmakuSwitchSave;

                        /**
                         * Creates a plain object from a PlayerDanmakuSwitchSave message. Also converts values to other types if specified.
                         * @param message PlayerDanmakuSwitchSave
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.PlayerDanmakuSwitchSave, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this PlayerDanmakuSwitchSave to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for PlayerDanmakuSwitchSave
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace PlayerDanmakuSwitchSave {

                        /** Properties of a PlayerDanmakuSwitchSave. */
                        interface $Properties {

                            /** PlayerDanmakuSwitchSave value */
                            value?: (boolean|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of a PlayerDanmakuSwitchSave. */
                        type $Shape = bilibili.community.service.dm.v1.PlayerDanmakuSwitchSave.$Properties;
                    }

                    /**
                     * Properties of a PlayerDanmakuUseDefaultConfig.
                     * @deprecated Use bilibili.community.service.dm.v1.PlayerDanmakuUseDefaultConfig.$Properties instead.
                     */
                    interface IPlayerDanmakuUseDefaultConfig extends bilibili.community.service.dm.v1.PlayerDanmakuUseDefaultConfig.$Properties {
                    }

                    /** Represents a PlayerDanmakuUseDefaultConfig. */
                    class PlayerDanmakuUseDefaultConfig {

                        /**
                         * Constructs a new PlayerDanmakuUseDefaultConfig.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.PlayerDanmakuUseDefaultConfig.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** PlayerDanmakuUseDefaultConfig value. */
                        value: boolean;

                        /**
                         * Creates a new PlayerDanmakuUseDefaultConfig instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns PlayerDanmakuUseDefaultConfig instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.PlayerDanmakuUseDefaultConfig.$Shape): bilibili.community.service.dm.v1.PlayerDanmakuUseDefaultConfig & bilibili.community.service.dm.v1.PlayerDanmakuUseDefaultConfig.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.PlayerDanmakuUseDefaultConfig.$Properties): bilibili.community.service.dm.v1.PlayerDanmakuUseDefaultConfig;

                        /**
                         * Encodes the specified PlayerDanmakuUseDefaultConfig message. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuUseDefaultConfig.verify|verify} messages.
                         * @param message PlayerDanmakuUseDefaultConfig message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.PlayerDanmakuUseDefaultConfig.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified PlayerDanmakuUseDefaultConfig message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuUseDefaultConfig.verify|verify} messages.
                         * @param message PlayerDanmakuUseDefaultConfig message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.PlayerDanmakuUseDefaultConfig.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a PlayerDanmakuUseDefaultConfig message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.PlayerDanmakuUseDefaultConfig & bilibili.community.service.dm.v1.PlayerDanmakuUseDefaultConfig.$Shape} PlayerDanmakuUseDefaultConfig
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.PlayerDanmakuUseDefaultConfig & bilibili.community.service.dm.v1.PlayerDanmakuUseDefaultConfig.$Shape;

                        /**
                         * Decodes a PlayerDanmakuUseDefaultConfig message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.PlayerDanmakuUseDefaultConfig & bilibili.community.service.dm.v1.PlayerDanmakuUseDefaultConfig.$Shape} PlayerDanmakuUseDefaultConfig
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.PlayerDanmakuUseDefaultConfig & bilibili.community.service.dm.v1.PlayerDanmakuUseDefaultConfig.$Shape;

                        /**
                         * Verifies a PlayerDanmakuUseDefaultConfig message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a PlayerDanmakuUseDefaultConfig message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns PlayerDanmakuUseDefaultConfig
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.PlayerDanmakuUseDefaultConfig;

                        /**
                         * Creates a plain object from a PlayerDanmakuUseDefaultConfig message. Also converts values to other types if specified.
                         * @param message PlayerDanmakuUseDefaultConfig
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.PlayerDanmakuUseDefaultConfig, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this PlayerDanmakuUseDefaultConfig to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for PlayerDanmakuUseDefaultConfig
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace PlayerDanmakuUseDefaultConfig {

                        /** Properties of a PlayerDanmakuUseDefaultConfig. */
                        interface $Properties {

                            /** PlayerDanmakuUseDefaultConfig value */
                            value?: (boolean|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of a PlayerDanmakuUseDefaultConfig. */
                        type $Shape = bilibili.community.service.dm.v1.PlayerDanmakuUseDefaultConfig.$Properties;
                    }

                    /**
                     * Properties of a PostPanel.
                     * @deprecated Use bilibili.community.service.dm.v1.PostPanel.$Properties instead.
                     */
                    interface IPostPanel extends bilibili.community.service.dm.v1.PostPanel.$Properties {
                    }

                    /** Represents a PostPanel. */
                    class PostPanel {

                        /**
                         * Constructs a new PostPanel.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.PostPanel.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** PostPanel start. */
                        start: (number|Long);

                        /** PostPanel end. */
                        end: (number|Long);

                        /** PostPanel priority. */
                        priority: (number|Long);

                        /** PostPanel bizId. */
                        bizId: (number|Long);

                        /** PostPanel bizType. */
                        bizType: bilibili.community.service.dm.v1.PostPanelBizType;

                        /** PostPanel clickButton. */
                        clickButton?: (bilibili.community.service.dm.v1.ClickButton.$Properties|null);

                        /** PostPanel textInput. */
                        textInput?: (bilibili.community.service.dm.v1.TextInput.$Properties|null);

                        /** PostPanel checkBox. */
                        checkBox?: (bilibili.community.service.dm.v1.CheckBox.$Properties|null);

                        /** PostPanel toast. */
                        toast?: (bilibili.community.service.dm.v1.Toast.$Properties|null);

                        /**
                         * Creates a new PostPanel instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns PostPanel instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.PostPanel.$Shape): bilibili.community.service.dm.v1.PostPanel & bilibili.community.service.dm.v1.PostPanel.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.PostPanel.$Properties): bilibili.community.service.dm.v1.PostPanel;

                        /**
                         * Encodes the specified PostPanel message. Does not implicitly {@link bilibili.community.service.dm.v1.PostPanel.verify|verify} messages.
                         * @param message PostPanel message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.PostPanel.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified PostPanel message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.PostPanel.verify|verify} messages.
                         * @param message PostPanel message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.PostPanel.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a PostPanel message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.PostPanel & bilibili.community.service.dm.v1.PostPanel.$Shape} PostPanel
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.PostPanel & bilibili.community.service.dm.v1.PostPanel.$Shape;

                        /**
                         * Decodes a PostPanel message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.PostPanel & bilibili.community.service.dm.v1.PostPanel.$Shape} PostPanel
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.PostPanel & bilibili.community.service.dm.v1.PostPanel.$Shape;

                        /**
                         * Verifies a PostPanel message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a PostPanel message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns PostPanel
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.PostPanel;

                        /**
                         * Creates a plain object from a PostPanel message. Also converts values to other types if specified.
                         * @param message PostPanel
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.PostPanel, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this PostPanel to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for PostPanel
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace PostPanel {

                        /** Properties of a PostPanel. */
                        interface $Properties {

                            /** PostPanel start */
                            start?: (number|Long|null);

                            /** PostPanel end */
                            end?: (number|Long|null);

                            /** PostPanel priority */
                            priority?: (number|Long|null);

                            /** PostPanel bizId */
                            bizId?: (number|Long|null);

                            /** PostPanel bizType */
                            bizType?: (bilibili.community.service.dm.v1.PostPanelBizType|null);

                            /** PostPanel clickButton */
                            clickButton?: (bilibili.community.service.dm.v1.ClickButton.$Properties|null);

                            /** PostPanel textInput */
                            textInput?: (bilibili.community.service.dm.v1.TextInput.$Properties|null);

                            /** PostPanel checkBox */
                            checkBox?: (bilibili.community.service.dm.v1.CheckBox.$Properties|null);

                            /** PostPanel toast */
                            toast?: (bilibili.community.service.dm.v1.Toast.$Properties|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of a PostPanel. */
                        type $Shape = bilibili.community.service.dm.v1.PostPanel.$Properties;
                    }

                    /** PostPanelBizType enum. */
                    enum PostPanelBizType {

                        /** PostPanelBizTypeNone value */
                        PostPanelBizTypeNone = 0,

                        /** PostPanelBizTypeEncourage value */
                        PostPanelBizTypeEncourage = 1,

                        /** PostPanelBizTypeColorDM value */
                        PostPanelBizTypeColorDM = 2,

                        /** PostPanelBizTypeNFTDM value */
                        PostPanelBizTypeNFTDM = 3,

                        /** PostPanelBizTypeFragClose value */
                        PostPanelBizTypeFragClose = 4,

                        /** PostPanelBizTypeRecommend value */
                        PostPanelBizTypeRecommend = 5
                    }

                    /**
                     * Properties of a PostPanelV2.
                     * @deprecated Use bilibili.community.service.dm.v1.PostPanelV2.$Properties instead.
                     */
                    interface IPostPanelV2 extends bilibili.community.service.dm.v1.PostPanelV2.$Properties {
                    }

                    /** Represents a PostPanelV2. */
                    class PostPanelV2 {

                        /**
                         * Constructs a new PostPanelV2.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.PostPanelV2.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** PostPanelV2 start. */
                        start: (number|Long);

                        /** PostPanelV2 end. */
                        end: (number|Long);

                        /** PostPanelV2 bizType. */
                        bizType: number;

                        /** PostPanelV2 clickButton. */
                        clickButton?: (bilibili.community.service.dm.v1.ClickButtonV2.$Properties|null);

                        /** PostPanelV2 textInput. */
                        textInput?: (bilibili.community.service.dm.v1.TextInputV2.$Properties|null);

                        /** PostPanelV2 checkBox. */
                        checkBox?: (bilibili.community.service.dm.v1.CheckBoxV2.$Properties|null);

                        /** PostPanelV2 toast. */
                        toast?: (bilibili.community.service.dm.v1.ToastV2.$Properties|null);

                        /** PostPanelV2 bubble. */
                        bubble?: (bilibili.community.service.dm.v1.BubbleV2.$Properties|null);

                        /** PostPanelV2 label. */
                        label?: (bilibili.community.service.dm.v1.LabelV2.$Properties|null);

                        /** PostPanelV2 postStatus. */
                        postStatus: number;

                        /**
                         * Creates a new PostPanelV2 instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns PostPanelV2 instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.PostPanelV2.$Shape): bilibili.community.service.dm.v1.PostPanelV2 & bilibili.community.service.dm.v1.PostPanelV2.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.PostPanelV2.$Properties): bilibili.community.service.dm.v1.PostPanelV2;

                        /**
                         * Encodes the specified PostPanelV2 message. Does not implicitly {@link bilibili.community.service.dm.v1.PostPanelV2.verify|verify} messages.
                         * @param message PostPanelV2 message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.PostPanelV2.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified PostPanelV2 message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.PostPanelV2.verify|verify} messages.
                         * @param message PostPanelV2 message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.PostPanelV2.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a PostPanelV2 message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.PostPanelV2 & bilibili.community.service.dm.v1.PostPanelV2.$Shape} PostPanelV2
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.PostPanelV2 & bilibili.community.service.dm.v1.PostPanelV2.$Shape;

                        /**
                         * Decodes a PostPanelV2 message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.PostPanelV2 & bilibili.community.service.dm.v1.PostPanelV2.$Shape} PostPanelV2
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.PostPanelV2 & bilibili.community.service.dm.v1.PostPanelV2.$Shape;

                        /**
                         * Verifies a PostPanelV2 message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a PostPanelV2 message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns PostPanelV2
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.PostPanelV2;

                        /**
                         * Creates a plain object from a PostPanelV2 message. Also converts values to other types if specified.
                         * @param message PostPanelV2
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.PostPanelV2, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this PostPanelV2 to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for PostPanelV2
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace PostPanelV2 {

                        /** Properties of a PostPanelV2. */
                        interface $Properties {

                            /** PostPanelV2 start */
                            start?: (number|Long|null);

                            /** PostPanelV2 end */
                            end?: (number|Long|null);

                            /** PostPanelV2 bizType */
                            bizType?: (number|null);

                            /** PostPanelV2 clickButton */
                            clickButton?: (bilibili.community.service.dm.v1.ClickButtonV2.$Properties|null);

                            /** PostPanelV2 textInput */
                            textInput?: (bilibili.community.service.dm.v1.TextInputV2.$Properties|null);

                            /** PostPanelV2 checkBox */
                            checkBox?: (bilibili.community.service.dm.v1.CheckBoxV2.$Properties|null);

                            /** PostPanelV2 toast */
                            toast?: (bilibili.community.service.dm.v1.ToastV2.$Properties|null);

                            /** PostPanelV2 bubble */
                            bubble?: (bilibili.community.service.dm.v1.BubbleV2.$Properties|null);

                            /** PostPanelV2 label */
                            label?: (bilibili.community.service.dm.v1.LabelV2.$Properties|null);

                            /** PostPanelV2 postStatus */
                            postStatus?: (number|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of a PostPanelV2. */
                        type $Shape = bilibili.community.service.dm.v1.PostPanelV2.$Properties;
                    }

                    /** PostStatus enum. */
                    enum PostStatus {

                        /** PostStatusNormal value */
                        PostStatusNormal = 0,

                        /** PostStatusClosed value */
                        PostStatusClosed = 1
                    }

                    /** RenderType enum. */
                    enum RenderType {

                        /** RenderTypeNone value */
                        RenderTypeNone = 0,

                        /** RenderTypeSingle value */
                        RenderTypeSingle = 1,

                        /** RenderTypeRotation value */
                        RenderTypeRotation = 2
                    }

                    /**
                     * Properties of a Response.
                     * @deprecated Use bilibili.community.service.dm.v1.Response.$Properties instead.
                     */
                    interface IResponse extends bilibili.community.service.dm.v1.Response.$Properties {
                    }

                    /** Represents a Response. */
                    class Response {

                        /**
                         * Constructs a new Response.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.Response.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** Response code. */
                        code: number;

                        /** Response message. */
                        message: string;

                        /**
                         * Creates a new Response instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns Response instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.Response.$Shape): bilibili.community.service.dm.v1.Response & bilibili.community.service.dm.v1.Response.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.Response.$Properties): bilibili.community.service.dm.v1.Response;

                        /**
                         * Encodes the specified Response message. Does not implicitly {@link bilibili.community.service.dm.v1.Response.verify|verify} messages.
                         * @param message Response message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.Response.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified Response message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.Response.verify|verify} messages.
                         * @param message Response message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.Response.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a Response message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.Response & bilibili.community.service.dm.v1.Response.$Shape} Response
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.Response & bilibili.community.service.dm.v1.Response.$Shape;

                        /**
                         * Decodes a Response message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.Response & bilibili.community.service.dm.v1.Response.$Shape} Response
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.Response & bilibili.community.service.dm.v1.Response.$Shape;

                        /**
                         * Verifies a Response message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a Response message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns Response
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.Response;

                        /**
                         * Creates a plain object from a Response message. Also converts values to other types if specified.
                         * @param message Response
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.Response, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this Response to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for Response
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace Response {

                        /** Properties of a Response. */
                        interface $Properties {

                            /** Response code */
                            code?: (number|null);

                            /** Response message */
                            message?: (string|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of a Response. */
                        type $Shape = bilibili.community.service.dm.v1.Response.$Properties;
                    }

                    /** SubtitleAiStatus enum. */
                    enum SubtitleAiStatus {

                        /** None value */
                        None = 0,

                        /** Exposure value */
                        Exposure = 1,

                        /** Assist value */
                        Assist = 2
                    }

                    /** SubtitleAiType enum. */
                    enum SubtitleAiType {

                        /** Normal value */
                        Normal = 0,

                        /** Translate value */
                        Translate = 1
                    }

                    /**
                     * Properties of a SubtitleItem.
                     * @deprecated Use bilibili.community.service.dm.v1.SubtitleItem.$Properties instead.
                     */
                    interface ISubtitleItem extends bilibili.community.service.dm.v1.SubtitleItem.$Properties {
                    }

                    /** Represents a SubtitleItem. */
                    class SubtitleItem {

                        /**
                         * Constructs a new SubtitleItem.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.SubtitleItem.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** SubtitleItem id. */
                        id: (number|Long);

                        /** SubtitleItem idStr. */
                        idStr: string;

                        /** SubtitleItem lan. */
                        lan: string;

                        /** SubtitleItem lanDoc. */
                        lanDoc: string;

                        /** SubtitleItem subtitleUrl. */
                        subtitleUrl: string;

                        /** SubtitleItem author. */
                        author?: (bilibili.community.service.dm.v1.UserInfo.$Properties|null);

                        /** SubtitleItem type. */
                        type: bilibili.community.service.dm.v1.SubtitleType;

                        /** SubtitleItem lanDocBrief. */
                        lanDocBrief: string;

                        /** SubtitleItem aiType. */
                        aiType: bilibili.community.service.dm.v1.SubtitleAiType;

                        /** SubtitleItem aiStatus. */
                        aiStatus: bilibili.community.service.dm.v1.SubtitleAiStatus;

                        /**
                         * Creates a new SubtitleItem instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns SubtitleItem instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.SubtitleItem.$Shape): bilibili.community.service.dm.v1.SubtitleItem & bilibili.community.service.dm.v1.SubtitleItem.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.SubtitleItem.$Properties): bilibili.community.service.dm.v1.SubtitleItem;

                        /**
                         * Encodes the specified SubtitleItem message. Does not implicitly {@link bilibili.community.service.dm.v1.SubtitleItem.verify|verify} messages.
                         * @param message SubtitleItem message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.SubtitleItem.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified SubtitleItem message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.SubtitleItem.verify|verify} messages.
                         * @param message SubtitleItem message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.SubtitleItem.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a SubtitleItem message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.SubtitleItem & bilibili.community.service.dm.v1.SubtitleItem.$Shape} SubtitleItem
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.SubtitleItem & bilibili.community.service.dm.v1.SubtitleItem.$Shape;

                        /**
                         * Decodes a SubtitleItem message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.SubtitleItem & bilibili.community.service.dm.v1.SubtitleItem.$Shape} SubtitleItem
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.SubtitleItem & bilibili.community.service.dm.v1.SubtitleItem.$Shape;

                        /**
                         * Verifies a SubtitleItem message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a SubtitleItem message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns SubtitleItem
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.SubtitleItem;

                        /**
                         * Creates a plain object from a SubtitleItem message. Also converts values to other types if specified.
                         * @param message SubtitleItem
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.SubtitleItem, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this SubtitleItem to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for SubtitleItem
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace SubtitleItem {

                        /** Properties of a SubtitleItem. */
                        interface $Properties {

                            /** SubtitleItem id */
                            id?: (number|Long|null);

                            /** SubtitleItem idStr */
                            idStr?: (string|null);

                            /** SubtitleItem lan */
                            lan?: (string|null);

                            /** SubtitleItem lanDoc */
                            lanDoc?: (string|null);

                            /** SubtitleItem subtitleUrl */
                            subtitleUrl?: (string|null);

                            /** SubtitleItem author */
                            author?: (bilibili.community.service.dm.v1.UserInfo.$Properties|null);

                            /** SubtitleItem type */
                            type?: (bilibili.community.service.dm.v1.SubtitleType|null);

                            /** SubtitleItem lanDocBrief */
                            lanDocBrief?: (string|null);

                            /** SubtitleItem aiType */
                            aiType?: (bilibili.community.service.dm.v1.SubtitleAiType|null);

                            /** SubtitleItem aiStatus */
                            aiStatus?: (bilibili.community.service.dm.v1.SubtitleAiStatus|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of a SubtitleItem. */
                        type $Shape = bilibili.community.service.dm.v1.SubtitleItem.$Properties;
                    }

                    /** SubtitleType enum. */
                    enum SubtitleType {

                        /** CC value */
                        CC = 0,

                        /** AI value */
                        AI = 1
                    }

                    /**
                     * Properties of a TextInput.
                     * @deprecated Use bilibili.community.service.dm.v1.TextInput.$Properties instead.
                     */
                    interface ITextInput extends bilibili.community.service.dm.v1.TextInput.$Properties {
                    }

                    /** Represents a TextInput. */
                    class TextInput {

                        /**
                         * Constructs a new TextInput.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.TextInput.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** TextInput portraitPlaceholder. */
                        portraitPlaceholder: string[];

                        /** TextInput landscapePlaceholder. */
                        landscapePlaceholder: string[];

                        /** TextInput renderType. */
                        renderType: bilibili.community.service.dm.v1.RenderType;

                        /** TextInput placeholderPost. */
                        placeholderPost: boolean;

                        /** TextInput show. */
                        show: boolean;

                        /** TextInput avatar. */
                        avatar: bilibili.community.service.dm.v1.Avatar.$Properties[];

                        /** TextInput postStatus. */
                        postStatus: bilibili.community.service.dm.v1.PostStatus;

                        /** TextInput label. */
                        label?: (bilibili.community.service.dm.v1.Label.$Properties|null);

                        /**
                         * Creates a new TextInput instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns TextInput instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.TextInput.$Shape): bilibili.community.service.dm.v1.TextInput & bilibili.community.service.dm.v1.TextInput.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.TextInput.$Properties): bilibili.community.service.dm.v1.TextInput;

                        /**
                         * Encodes the specified TextInput message. Does not implicitly {@link bilibili.community.service.dm.v1.TextInput.verify|verify} messages.
                         * @param message TextInput message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.TextInput.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified TextInput message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.TextInput.verify|verify} messages.
                         * @param message TextInput message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.TextInput.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a TextInput message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.TextInput & bilibili.community.service.dm.v1.TextInput.$Shape} TextInput
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.TextInput & bilibili.community.service.dm.v1.TextInput.$Shape;

                        /**
                         * Decodes a TextInput message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.TextInput & bilibili.community.service.dm.v1.TextInput.$Shape} TextInput
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.TextInput & bilibili.community.service.dm.v1.TextInput.$Shape;

                        /**
                         * Verifies a TextInput message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a TextInput message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns TextInput
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.TextInput;

                        /**
                         * Creates a plain object from a TextInput message. Also converts values to other types if specified.
                         * @param message TextInput
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.TextInput, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this TextInput to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for TextInput
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace TextInput {

                        /** Properties of a TextInput. */
                        interface $Properties {

                            /** TextInput portraitPlaceholder */
                            portraitPlaceholder?: (string[]|null);

                            /** TextInput landscapePlaceholder */
                            landscapePlaceholder?: (string[]|null);

                            /** TextInput renderType */
                            renderType?: (bilibili.community.service.dm.v1.RenderType|null);

                            /** TextInput placeholderPost */
                            placeholderPost?: (boolean|null);

                            /** TextInput show */
                            show?: (boolean|null);

                            /** TextInput avatar */
                            avatar?: (bilibili.community.service.dm.v1.Avatar.$Properties[]|null);

                            /** TextInput postStatus */
                            postStatus?: (bilibili.community.service.dm.v1.PostStatus|null);

                            /** TextInput label */
                            label?: (bilibili.community.service.dm.v1.Label.$Properties|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of a TextInput. */
                        type $Shape = bilibili.community.service.dm.v1.TextInput.$Properties;
                    }

                    /**
                     * Properties of a TextInputV2.
                     * @deprecated Use bilibili.community.service.dm.v1.TextInputV2.$Properties instead.
                     */
                    interface ITextInputV2 extends bilibili.community.service.dm.v1.TextInputV2.$Properties {
                    }

                    /** Represents a TextInputV2. */
                    class TextInputV2 {

                        /**
                         * Constructs a new TextInputV2.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.TextInputV2.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** TextInputV2 portraitPlaceholder. */
                        portraitPlaceholder: string[];

                        /** TextInputV2 landscapePlaceholder. */
                        landscapePlaceholder: string[];

                        /** TextInputV2 renderType. */
                        renderType: bilibili.community.service.dm.v1.RenderType;

                        /** TextInputV2 placeholderPost. */
                        placeholderPost: boolean;

                        /** TextInputV2 avatar. */
                        avatar: bilibili.community.service.dm.v1.Avatar.$Properties[];

                        /** TextInputV2 textInputLimit. */
                        textInputLimit: number;

                        /**
                         * Creates a new TextInputV2 instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns TextInputV2 instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.TextInputV2.$Shape): bilibili.community.service.dm.v1.TextInputV2 & bilibili.community.service.dm.v1.TextInputV2.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.TextInputV2.$Properties): bilibili.community.service.dm.v1.TextInputV2;

                        /**
                         * Encodes the specified TextInputV2 message. Does not implicitly {@link bilibili.community.service.dm.v1.TextInputV2.verify|verify} messages.
                         * @param message TextInputV2 message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.TextInputV2.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified TextInputV2 message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.TextInputV2.verify|verify} messages.
                         * @param message TextInputV2 message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.TextInputV2.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a TextInputV2 message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.TextInputV2 & bilibili.community.service.dm.v1.TextInputV2.$Shape} TextInputV2
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.TextInputV2 & bilibili.community.service.dm.v1.TextInputV2.$Shape;

                        /**
                         * Decodes a TextInputV2 message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.TextInputV2 & bilibili.community.service.dm.v1.TextInputV2.$Shape} TextInputV2
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.TextInputV2 & bilibili.community.service.dm.v1.TextInputV2.$Shape;

                        /**
                         * Verifies a TextInputV2 message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a TextInputV2 message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns TextInputV2
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.TextInputV2;

                        /**
                         * Creates a plain object from a TextInputV2 message. Also converts values to other types if specified.
                         * @param message TextInputV2
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.TextInputV2, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this TextInputV2 to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for TextInputV2
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace TextInputV2 {

                        /** Properties of a TextInputV2. */
                        interface $Properties {

                            /** TextInputV2 portraitPlaceholder */
                            portraitPlaceholder?: (string[]|null);

                            /** TextInputV2 landscapePlaceholder */
                            landscapePlaceholder?: (string[]|null);

                            /** TextInputV2 renderType */
                            renderType?: (bilibili.community.service.dm.v1.RenderType|null);

                            /** TextInputV2 placeholderPost */
                            placeholderPost?: (boolean|null);

                            /** TextInputV2 avatar */
                            avatar?: (bilibili.community.service.dm.v1.Avatar.$Properties[]|null);

                            /** TextInputV2 textInputLimit */
                            textInputLimit?: (number|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of a TextInputV2. */
                        type $Shape = bilibili.community.service.dm.v1.TextInputV2.$Properties;
                    }

                    /**
                     * Properties of a Toast.
                     * @deprecated Use bilibili.community.service.dm.v1.Toast.$Properties instead.
                     */
                    interface IToast extends bilibili.community.service.dm.v1.Toast.$Properties {
                    }

                    /** Represents a Toast. */
                    class Toast {

                        /**
                         * Constructs a new Toast.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.Toast.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** Toast text. */
                        text: string;

                        /** Toast duration. */
                        duration: number;

                        /** Toast show. */
                        show: boolean;

                        /** Toast button. */
                        button?: (bilibili.community.service.dm.v1.Button.$Properties|null);

                        /**
                         * Creates a new Toast instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns Toast instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.Toast.$Shape): bilibili.community.service.dm.v1.Toast & bilibili.community.service.dm.v1.Toast.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.Toast.$Properties): bilibili.community.service.dm.v1.Toast;

                        /**
                         * Encodes the specified Toast message. Does not implicitly {@link bilibili.community.service.dm.v1.Toast.verify|verify} messages.
                         * @param message Toast message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.Toast.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified Toast message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.Toast.verify|verify} messages.
                         * @param message Toast message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.Toast.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a Toast message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.Toast & bilibili.community.service.dm.v1.Toast.$Shape} Toast
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.Toast & bilibili.community.service.dm.v1.Toast.$Shape;

                        /**
                         * Decodes a Toast message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.Toast & bilibili.community.service.dm.v1.Toast.$Shape} Toast
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.Toast & bilibili.community.service.dm.v1.Toast.$Shape;

                        /**
                         * Verifies a Toast message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a Toast message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns Toast
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.Toast;

                        /**
                         * Creates a plain object from a Toast message. Also converts values to other types if specified.
                         * @param message Toast
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.Toast, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this Toast to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for Toast
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace Toast {

                        /** Properties of a Toast. */
                        interface $Properties {

                            /** Toast text */
                            text?: (string|null);

                            /** Toast duration */
                            duration?: (number|null);

                            /** Toast show */
                            show?: (boolean|null);

                            /** Toast button */
                            button?: (bilibili.community.service.dm.v1.Button.$Properties|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of a Toast. */
                        type $Shape = bilibili.community.service.dm.v1.Toast.$Properties;
                    }

                    /**
                     * Properties of a ToastButtonV2.
                     * @deprecated Use bilibili.community.service.dm.v1.ToastButtonV2.$Properties instead.
                     */
                    interface IToastButtonV2 extends bilibili.community.service.dm.v1.ToastButtonV2.$Properties {
                    }

                    /** Represents a ToastButtonV2. */
                    class ToastButtonV2 {

                        /**
                         * Constructs a new ToastButtonV2.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.ToastButtonV2.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** ToastButtonV2 text. */
                        text: string;

                        /** ToastButtonV2 action. */
                        action: number;

                        /**
                         * Creates a new ToastButtonV2 instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns ToastButtonV2 instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.ToastButtonV2.$Shape): bilibili.community.service.dm.v1.ToastButtonV2 & bilibili.community.service.dm.v1.ToastButtonV2.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.ToastButtonV2.$Properties): bilibili.community.service.dm.v1.ToastButtonV2;

                        /**
                         * Encodes the specified ToastButtonV2 message. Does not implicitly {@link bilibili.community.service.dm.v1.ToastButtonV2.verify|verify} messages.
                         * @param message ToastButtonV2 message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.ToastButtonV2.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified ToastButtonV2 message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.ToastButtonV2.verify|verify} messages.
                         * @param message ToastButtonV2 message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.ToastButtonV2.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a ToastButtonV2 message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.ToastButtonV2 & bilibili.community.service.dm.v1.ToastButtonV2.$Shape} ToastButtonV2
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.ToastButtonV2 & bilibili.community.service.dm.v1.ToastButtonV2.$Shape;

                        /**
                         * Decodes a ToastButtonV2 message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.ToastButtonV2 & bilibili.community.service.dm.v1.ToastButtonV2.$Shape} ToastButtonV2
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.ToastButtonV2 & bilibili.community.service.dm.v1.ToastButtonV2.$Shape;

                        /**
                         * Verifies a ToastButtonV2 message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a ToastButtonV2 message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns ToastButtonV2
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.ToastButtonV2;

                        /**
                         * Creates a plain object from a ToastButtonV2 message. Also converts values to other types if specified.
                         * @param message ToastButtonV2
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.ToastButtonV2, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this ToastButtonV2 to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for ToastButtonV2
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace ToastButtonV2 {

                        /** Properties of a ToastButtonV2. */
                        interface $Properties {

                            /** ToastButtonV2 text */
                            text?: (string|null);

                            /** ToastButtonV2 action */
                            action?: (number|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of a ToastButtonV2. */
                        type $Shape = bilibili.community.service.dm.v1.ToastButtonV2.$Properties;
                    }

                    /** ToastFunctionType enum. */
                    enum ToastFunctionType {

                        /** ToastFunctionTypeNone value */
                        ToastFunctionTypeNone = 0,

                        /** ToastFunctionTypePostPanel value */
                        ToastFunctionTypePostPanel = 1
                    }

                    /**
                     * Properties of a ToastV2.
                     * @deprecated Use bilibili.community.service.dm.v1.ToastV2.$Properties instead.
                     */
                    interface IToastV2 extends bilibili.community.service.dm.v1.ToastV2.$Properties {
                    }

                    /** Represents a ToastV2. */
                    class ToastV2 {

                        /**
                         * Constructs a new ToastV2.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.ToastV2.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** ToastV2 text. */
                        text: string;

                        /** ToastV2 duration. */
                        duration: number;

                        /** ToastV2 toastButtonV2. */
                        toastButtonV2?: (bilibili.community.service.dm.v1.ToastButtonV2.$Properties|null);

                        /**
                         * Creates a new ToastV2 instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns ToastV2 instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.ToastV2.$Shape): bilibili.community.service.dm.v1.ToastV2 & bilibili.community.service.dm.v1.ToastV2.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.ToastV2.$Properties): bilibili.community.service.dm.v1.ToastV2;

                        /**
                         * Encodes the specified ToastV2 message. Does not implicitly {@link bilibili.community.service.dm.v1.ToastV2.verify|verify} messages.
                         * @param message ToastV2 message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.ToastV2.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified ToastV2 message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.ToastV2.verify|verify} messages.
                         * @param message ToastV2 message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.ToastV2.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a ToastV2 message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.ToastV2 & bilibili.community.service.dm.v1.ToastV2.$Shape} ToastV2
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.ToastV2 & bilibili.community.service.dm.v1.ToastV2.$Shape;

                        /**
                         * Decodes a ToastV2 message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.ToastV2 & bilibili.community.service.dm.v1.ToastV2.$Shape} ToastV2
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.ToastV2 & bilibili.community.service.dm.v1.ToastV2.$Shape;

                        /**
                         * Verifies a ToastV2 message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a ToastV2 message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns ToastV2
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.ToastV2;

                        /**
                         * Creates a plain object from a ToastV2 message. Also converts values to other types if specified.
                         * @param message ToastV2
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.ToastV2, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this ToastV2 to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for ToastV2
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace ToastV2 {

                        /** Properties of a ToastV2. */
                        interface $Properties {

                            /** ToastV2 text */
                            text?: (string|null);

                            /** ToastV2 duration */
                            duration?: (number|null);

                            /** ToastV2 toastButtonV2 */
                            toastButtonV2?: (bilibili.community.service.dm.v1.ToastButtonV2.$Properties|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of a ToastV2. */
                        type $Shape = bilibili.community.service.dm.v1.ToastV2.$Properties;
                    }

                    /**
                     * Properties of a UserInfo.
                     * @deprecated Use bilibili.community.service.dm.v1.UserInfo.$Properties instead.
                     */
                    interface IUserInfo extends bilibili.community.service.dm.v1.UserInfo.$Properties {
                    }

                    /** Represents a UserInfo. */
                    class UserInfo {

                        /**
                         * Constructs a new UserInfo.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.UserInfo.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** UserInfo mid. */
                        mid: (number|Long);

                        /** UserInfo name. */
                        name: string;

                        /** UserInfo sex. */
                        sex: string;

                        /** UserInfo face. */
                        face: string;

                        /** UserInfo sign. */
                        sign: string;

                        /** UserInfo rank. */
                        rank: number;

                        /**
                         * Creates a new UserInfo instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns UserInfo instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.UserInfo.$Shape): bilibili.community.service.dm.v1.UserInfo & bilibili.community.service.dm.v1.UserInfo.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.UserInfo.$Properties): bilibili.community.service.dm.v1.UserInfo;

                        /**
                         * Encodes the specified UserInfo message. Does not implicitly {@link bilibili.community.service.dm.v1.UserInfo.verify|verify} messages.
                         * @param message UserInfo message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.UserInfo.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified UserInfo message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.UserInfo.verify|verify} messages.
                         * @param message UserInfo message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.UserInfo.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a UserInfo message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.UserInfo & bilibili.community.service.dm.v1.UserInfo.$Shape} UserInfo
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.UserInfo & bilibili.community.service.dm.v1.UserInfo.$Shape;

                        /**
                         * Decodes a UserInfo message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.UserInfo & bilibili.community.service.dm.v1.UserInfo.$Shape} UserInfo
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.UserInfo & bilibili.community.service.dm.v1.UserInfo.$Shape;

                        /**
                         * Verifies a UserInfo message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a UserInfo message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns UserInfo
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.UserInfo;

                        /**
                         * Creates a plain object from a UserInfo message. Also converts values to other types if specified.
                         * @param message UserInfo
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.UserInfo, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this UserInfo to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for UserInfo
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace UserInfo {

                        /** Properties of a UserInfo. */
                        interface $Properties {

                            /** UserInfo mid */
                            mid?: (number|Long|null);

                            /** UserInfo name */
                            name?: (string|null);

                            /** UserInfo sex */
                            sex?: (string|null);

                            /** UserInfo face */
                            face?: (string|null);

                            /** UserInfo sign */
                            sign?: (string|null);

                            /** UserInfo rank */
                            rank?: (number|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of a UserInfo. */
                        type $Shape = bilibili.community.service.dm.v1.UserInfo.$Properties;
                    }

                    /**
                     * Properties of a VideoMask.
                     * @deprecated Use bilibili.community.service.dm.v1.VideoMask.$Properties instead.
                     */
                    interface IVideoMask extends bilibili.community.service.dm.v1.VideoMask.$Properties {
                    }

                    /** Represents a VideoMask. */
                    class VideoMask {

                        /**
                         * Constructs a new VideoMask.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.VideoMask.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** VideoMask cid. */
                        cid: (number|Long);

                        /** VideoMask plat. */
                        plat: number;

                        /** VideoMask fps. */
                        fps: number;

                        /** VideoMask time. */
                        time: (number|Long);

                        /** VideoMask maskUrl. */
                        maskUrl: string;

                        /**
                         * Creates a new VideoMask instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns VideoMask instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.VideoMask.$Shape): bilibili.community.service.dm.v1.VideoMask & bilibili.community.service.dm.v1.VideoMask.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.VideoMask.$Properties): bilibili.community.service.dm.v1.VideoMask;

                        /**
                         * Encodes the specified VideoMask message. Does not implicitly {@link bilibili.community.service.dm.v1.VideoMask.verify|verify} messages.
                         * @param message VideoMask message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.VideoMask.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified VideoMask message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.VideoMask.verify|verify} messages.
                         * @param message VideoMask message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.VideoMask.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a VideoMask message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.VideoMask & bilibili.community.service.dm.v1.VideoMask.$Shape} VideoMask
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.VideoMask & bilibili.community.service.dm.v1.VideoMask.$Shape;

                        /**
                         * Decodes a VideoMask message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.VideoMask & bilibili.community.service.dm.v1.VideoMask.$Shape} VideoMask
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.VideoMask & bilibili.community.service.dm.v1.VideoMask.$Shape;

                        /**
                         * Verifies a VideoMask message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a VideoMask message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns VideoMask
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.VideoMask;

                        /**
                         * Creates a plain object from a VideoMask message. Also converts values to other types if specified.
                         * @param message VideoMask
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.VideoMask, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this VideoMask to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for VideoMask
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace VideoMask {

                        /** Properties of a VideoMask. */
                        interface $Properties {

                            /** VideoMask cid */
                            cid?: (number|Long|null);

                            /** VideoMask plat */
                            plat?: (number|null);

                            /** VideoMask fps */
                            fps?: (number|null);

                            /** VideoMask time */
                            time?: (number|Long|null);

                            /** VideoMask maskUrl */
                            maskUrl?: (string|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of a VideoMask. */
                        type $Shape = bilibili.community.service.dm.v1.VideoMask.$Properties;
                    }

                    /**
                     * Properties of a VideoSubtitle.
                     * @deprecated Use bilibili.community.service.dm.v1.VideoSubtitle.$Properties instead.
                     */
                    interface IVideoSubtitle extends bilibili.community.service.dm.v1.VideoSubtitle.$Properties {
                    }

                    /** Represents a VideoSubtitle. */
                    class VideoSubtitle {

                        /**
                         * Constructs a new VideoSubtitle.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.VideoSubtitle.$Properties);

                        /** Unknown fields preserved while decoding when enabled */
                        $unknowns?: Uint8Array[];

                        /** VideoSubtitle lan. */
                        lan: string;

                        /** VideoSubtitle lanDoc. */
                        lanDoc: string;

                        /** VideoSubtitle subtitles. */
                        subtitles: bilibili.community.service.dm.v1.SubtitleItem.$Properties[];

                        /**
                         * Creates a new VideoSubtitle instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns VideoSubtitle instance
                         */
                        static create(properties: bilibili.community.service.dm.v1.VideoSubtitle.$Shape): bilibili.community.service.dm.v1.VideoSubtitle & bilibili.community.service.dm.v1.VideoSubtitle.$Shape;
                        static create(properties?: bilibili.community.service.dm.v1.VideoSubtitle.$Properties): bilibili.community.service.dm.v1.VideoSubtitle;

                        /**
                         * Encodes the specified VideoSubtitle message. Does not implicitly {@link bilibili.community.service.dm.v1.VideoSubtitle.verify|verify} messages.
                         * @param message VideoSubtitle message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encode(message: bilibili.community.service.dm.v1.VideoSubtitle.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified VideoSubtitle message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.VideoSubtitle.verify|verify} messages.
                         * @param message VideoSubtitle message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        static encodeDelimited(message: bilibili.community.service.dm.v1.VideoSubtitle.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a VideoSubtitle message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns {bilibili.community.service.dm.v1.VideoSubtitle & bilibili.community.service.dm.v1.VideoSubtitle.$Shape} VideoSubtitle
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.VideoSubtitle & bilibili.community.service.dm.v1.VideoSubtitle.$Shape;

                        /**
                         * Decodes a VideoSubtitle message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns {bilibili.community.service.dm.v1.VideoSubtitle & bilibili.community.service.dm.v1.VideoSubtitle.$Shape} VideoSubtitle
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.VideoSubtitle & bilibili.community.service.dm.v1.VideoSubtitle.$Shape;

                        /**
                         * Verifies a VideoSubtitle message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a VideoSubtitle message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns VideoSubtitle
                         */
                        static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.VideoSubtitle;

                        /**
                         * Creates a plain object from a VideoSubtitle message. Also converts values to other types if specified.
                         * @param message VideoSubtitle
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        static toObject(message: bilibili.community.service.dm.v1.VideoSubtitle, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this VideoSubtitle to JSON.
                         * @returns JSON object
                         */
                        toJSON(): { [k: string]: any };

                        /**
                         * Gets the type url for VideoSubtitle
                         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
                         * @returns The type url
                         */
                        static getTypeUrl(prefix?: string): string;
                    }

                    namespace VideoSubtitle {

                        /** Properties of a VideoSubtitle. */
                        interface $Properties {

                            /** VideoSubtitle lan */
                            lan?: (string|null);

                            /** VideoSubtitle lanDoc */
                            lanDoc?: (string|null);

                            /** VideoSubtitle subtitles */
                            subtitles?: (bilibili.community.service.dm.v1.SubtitleItem.$Properties[]|null);

                            /** Unknown fields preserved while decoding when enabled */
                            $unknowns?: Uint8Array[];
                        }

                        /** Shape of a VideoSubtitle. */
                        type $Shape = bilibili.community.service.dm.v1.VideoSubtitle.$Properties;
                    }
                }
            }
        }
    }
}
