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
                        public static create(rpcImpl: $protobuf.RPCImpl, requestDelimited?: boolean, responseDelimited?: boolean): DM;

                        /**
                         * Calls DmSegMobile.
                         * @param request DmSegMobileReq message or plain object
                         * @param callback Node-style callback called with the error, if any, and DmSegMobileReply
                         */
                        public dmSegMobile(request: bilibili.community.service.dm.v1.IDmSegMobileReq, callback: bilibili.community.service.dm.v1.DM.DmSegMobileCallback): void;

                        /**
                         * Calls DmSegMobile.
                         * @param request DmSegMobileReq message or plain object
                         * @returns Promise
                         */
                        public dmSegMobile(request: bilibili.community.service.dm.v1.IDmSegMobileReq): Promise<bilibili.community.service.dm.v1.DmSegMobileReply>;

                        /**
                         * Calls DmView.
                         * @param request DmViewReq message or plain object
                         * @param callback Node-style callback called with the error, if any, and DmViewReply
                         */
                        public dmView(request: bilibili.community.service.dm.v1.IDmViewReq, callback: bilibili.community.service.dm.v1.DM.DmViewCallback): void;

                        /**
                         * Calls DmView.
                         * @param request DmViewReq message or plain object
                         * @returns Promise
                         */
                        public dmView(request: bilibili.community.service.dm.v1.IDmViewReq): Promise<bilibili.community.service.dm.v1.DmViewReply>;

                        /**
                         * Calls DmPlayerConfig.
                         * @param request DmPlayerConfigReq message or plain object
                         * @param callback Node-style callback called with the error, if any, and Response
                         */
                        public dmPlayerConfig(request: bilibili.community.service.dm.v1.IDmPlayerConfigReq, callback: bilibili.community.service.dm.v1.DM.DmPlayerConfigCallback): void;

                        /**
                         * Calls DmPlayerConfig.
                         * @param request DmPlayerConfigReq message or plain object
                         * @returns Promise
                         */
                        public dmPlayerConfig(request: bilibili.community.service.dm.v1.IDmPlayerConfigReq): Promise<bilibili.community.service.dm.v1.Response>;

                        /**
                         * Calls DmSegOtt.
                         * @param request DmSegOttReq message or plain object
                         * @param callback Node-style callback called with the error, if any, and DmSegOttReply
                         */
                        public dmSegOtt(request: bilibili.community.service.dm.v1.IDmSegOttReq, callback: bilibili.community.service.dm.v1.DM.DmSegOttCallback): void;

                        /**
                         * Calls DmSegOtt.
                         * @param request DmSegOttReq message or plain object
                         * @returns Promise
                         */
                        public dmSegOtt(request: bilibili.community.service.dm.v1.IDmSegOttReq): Promise<bilibili.community.service.dm.v1.DmSegOttReply>;

                        /**
                         * Calls DmSegSDK.
                         * @param request DmSegSDKReq message or plain object
                         * @param callback Node-style callback called with the error, if any, and DmSegSDKReply
                         */
                        public dmSegSDK(request: bilibili.community.service.dm.v1.IDmSegSDKReq, callback: bilibili.community.service.dm.v1.DM.DmSegSDKCallback): void;

                        /**
                         * Calls DmSegSDK.
                         * @param request DmSegSDKReq message or plain object
                         * @returns Promise
                         */
                        public dmSegSDK(request: bilibili.community.service.dm.v1.IDmSegSDKReq): Promise<bilibili.community.service.dm.v1.DmSegSDKReply>;

                        /**
                         * Calls DmExpoReport.
                         * @param request DmExpoReportReq message or plain object
                         * @param callback Node-style callback called with the error, if any, and DmExpoReportRes
                         */
                        public dmExpoReport(request: bilibili.community.service.dm.v1.IDmExpoReportReq, callback: bilibili.community.service.dm.v1.DM.DmExpoReportCallback): void;

                        /**
                         * Calls DmExpoReport.
                         * @param request DmExpoReportReq message or plain object
                         * @returns Promise
                         */
                        public dmExpoReport(request: bilibili.community.service.dm.v1.IDmExpoReportReq): Promise<bilibili.community.service.dm.v1.DmExpoReportRes>;
                    }

                    namespace DM {

                        /**
                         * Callback as used by {@link bilibili.community.service.dm.v1.DM#dmSegMobile}.
                         * @param error Error, if any
                         * @param [response] DmSegMobileReply
                         */
                        type DmSegMobileCallback = (error: (Error|null), response?: bilibili.community.service.dm.v1.DmSegMobileReply) => void;

                        /**
                         * Callback as used by {@link bilibili.community.service.dm.v1.DM#dmView}.
                         * @param error Error, if any
                         * @param [response] DmViewReply
                         */
                        type DmViewCallback = (error: (Error|null), response?: bilibili.community.service.dm.v1.DmViewReply) => void;

                        /**
                         * Callback as used by {@link bilibili.community.service.dm.v1.DM#dmPlayerConfig}.
                         * @param error Error, if any
                         * @param [response] Response
                         */
                        type DmPlayerConfigCallback = (error: (Error|null), response?: bilibili.community.service.dm.v1.Response) => void;

                        /**
                         * Callback as used by {@link bilibili.community.service.dm.v1.DM#dmSegOtt}.
                         * @param error Error, if any
                         * @param [response] DmSegOttReply
                         */
                        type DmSegOttCallback = (error: (Error|null), response?: bilibili.community.service.dm.v1.DmSegOttReply) => void;

                        /**
                         * Callback as used by {@link bilibili.community.service.dm.v1.DM#dmSegSDK}.
                         * @param error Error, if any
                         * @param [response] DmSegSDKReply
                         */
                        type DmSegSDKCallback = (error: (Error|null), response?: bilibili.community.service.dm.v1.DmSegSDKReply) => void;

                        /**
                         * Callback as used by {@link bilibili.community.service.dm.v1.DM#dmExpoReport}.
                         * @param error Error, if any
                         * @param [response] DmExpoReportRes
                         */
                        type DmExpoReportCallback = (error: (Error|null), response?: bilibili.community.service.dm.v1.DmExpoReportRes) => void;
                    }

                    /** Properties of an Avatar. */
                    interface IAvatar {

                        /** Avatar id */
                        id?: (string|null);

                        /** Avatar url */
                        url?: (string|null);

                        /** Avatar avatarType */
                        avatarType?: (bilibili.community.service.dm.v1.AvatarType|null);
                    }

                    /** Represents an Avatar. */
                    class Avatar implements IAvatar {

                        /**
                         * Constructs a new Avatar.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.IAvatar);

                        /** Avatar id. */
                        public id: string;

                        /** Avatar url. */
                        public url: string;

                        /** Avatar avatarType. */
                        public avatarType: bilibili.community.service.dm.v1.AvatarType;

                        /**
                         * Creates a new Avatar instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns Avatar instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.IAvatar): bilibili.community.service.dm.v1.Avatar;

                        /**
                         * Encodes the specified Avatar message. Does not implicitly {@link bilibili.community.service.dm.v1.Avatar.verify|verify} messages.
                         * @param message Avatar message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.IAvatar, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified Avatar message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.Avatar.verify|verify} messages.
                         * @param message Avatar message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.IAvatar, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes an Avatar message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns Avatar
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.Avatar;

                        /**
                         * Decodes an Avatar message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns Avatar
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.Avatar;

                        /**
                         * Verifies an Avatar message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates an Avatar message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns Avatar
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.Avatar;

                        /**
                         * Creates a plain object from an Avatar message. Also converts values to other types if specified.
                         * @param message Avatar
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.Avatar, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this Avatar to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for Avatar
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** AvatarType enum. */
                    enum AvatarType {
                        AvatarTypeNone = 0,
                        AvatarTypeNFT = 1
                    }

                    /** Properties of a Bubble. */
                    interface IBubble {

                        /** Bubble text */
                        text?: (string|null);

                        /** Bubble url */
                        url?: (string|null);
                    }

                    /** Represents a Bubble. */
                    class Bubble implements IBubble {

                        /**
                         * Constructs a new Bubble.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.IBubble);

                        /** Bubble text. */
                        public text: string;

                        /** Bubble url. */
                        public url: string;

                        /**
                         * Creates a new Bubble instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns Bubble instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.IBubble): bilibili.community.service.dm.v1.Bubble;

                        /**
                         * Encodes the specified Bubble message. Does not implicitly {@link bilibili.community.service.dm.v1.Bubble.verify|verify} messages.
                         * @param message Bubble message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.IBubble, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified Bubble message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.Bubble.verify|verify} messages.
                         * @param message Bubble message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.IBubble, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a Bubble message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns Bubble
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.Bubble;

                        /**
                         * Decodes a Bubble message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns Bubble
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.Bubble;

                        /**
                         * Verifies a Bubble message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a Bubble message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns Bubble
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.Bubble;

                        /**
                         * Creates a plain object from a Bubble message. Also converts values to other types if specified.
                         * @param message Bubble
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.Bubble, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this Bubble to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for Bubble
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** BubbleType enum. */
                    enum BubbleType {
                        BubbleTypeNone = 0,
                        BubbleTypeClickButton = 1,
                        BubbleTypeDmSettingPanel = 2
                    }

                    /** Properties of a BubbleV2. */
                    interface IBubbleV2 {

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
                    }

                    /** Represents a BubbleV2. */
                    class BubbleV2 implements IBubbleV2 {

                        /**
                         * Constructs a new BubbleV2.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.IBubbleV2);

                        /** BubbleV2 text. */
                        public text: string;

                        /** BubbleV2 url. */
                        public url: string;

                        /** BubbleV2 bubbleType. */
                        public bubbleType: bilibili.community.service.dm.v1.BubbleType;

                        /** BubbleV2 exposureOnce. */
                        public exposureOnce: boolean;

                        /** BubbleV2 exposureType. */
                        public exposureType: bilibili.community.service.dm.v1.ExposureType;

                        /**
                         * Creates a new BubbleV2 instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns BubbleV2 instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.IBubbleV2): bilibili.community.service.dm.v1.BubbleV2;

                        /**
                         * Encodes the specified BubbleV2 message. Does not implicitly {@link bilibili.community.service.dm.v1.BubbleV2.verify|verify} messages.
                         * @param message BubbleV2 message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.IBubbleV2, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified BubbleV2 message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.BubbleV2.verify|verify} messages.
                         * @param message BubbleV2 message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.IBubbleV2, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a BubbleV2 message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns BubbleV2
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.BubbleV2;

                        /**
                         * Decodes a BubbleV2 message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns BubbleV2
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.BubbleV2;

                        /**
                         * Verifies a BubbleV2 message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a BubbleV2 message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns BubbleV2
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.BubbleV2;

                        /**
                         * Creates a plain object from a BubbleV2 message. Also converts values to other types if specified.
                         * @param message BubbleV2
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.BubbleV2, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this BubbleV2 to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for BubbleV2
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** Properties of a Button. */
                    interface IButton {

                        /** Button text */
                        text?: (string|null);

                        /** Button action */
                        action?: (number|null);
                    }

                    /** Represents a Button. */
                    class Button implements IButton {

                        /**
                         * Constructs a new Button.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.IButton);

                        /** Button text. */
                        public text: string;

                        /** Button action. */
                        public action: number;

                        /**
                         * Creates a new Button instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns Button instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.IButton): bilibili.community.service.dm.v1.Button;

                        /**
                         * Encodes the specified Button message. Does not implicitly {@link bilibili.community.service.dm.v1.Button.verify|verify} messages.
                         * @param message Button message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.IButton, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified Button message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.Button.verify|verify} messages.
                         * @param message Button message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.IButton, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a Button message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns Button
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.Button;

                        /**
                         * Decodes a Button message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns Button
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.Button;

                        /**
                         * Verifies a Button message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a Button message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns Button
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.Button;

                        /**
                         * Creates a plain object from a Button message. Also converts values to other types if specified.
                         * @param message Button
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.Button, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this Button to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for Button
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** Properties of a BuzzwordConfig. */
                    interface IBuzzwordConfig {

                        /** BuzzwordConfig keywords */
                        keywords?: (bilibili.community.service.dm.v1.IBuzzwordShowConfig[]|null);
                    }

                    /** Represents a BuzzwordConfig. */
                    class BuzzwordConfig implements IBuzzwordConfig {

                        /**
                         * Constructs a new BuzzwordConfig.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.IBuzzwordConfig);

                        /** BuzzwordConfig keywords. */
                        public keywords: bilibili.community.service.dm.v1.IBuzzwordShowConfig[];

                        /**
                         * Creates a new BuzzwordConfig instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns BuzzwordConfig instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.IBuzzwordConfig): bilibili.community.service.dm.v1.BuzzwordConfig;

                        /**
                         * Encodes the specified BuzzwordConfig message. Does not implicitly {@link bilibili.community.service.dm.v1.BuzzwordConfig.verify|verify} messages.
                         * @param message BuzzwordConfig message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.IBuzzwordConfig, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified BuzzwordConfig message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.BuzzwordConfig.verify|verify} messages.
                         * @param message BuzzwordConfig message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.IBuzzwordConfig, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a BuzzwordConfig message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns BuzzwordConfig
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.BuzzwordConfig;

                        /**
                         * Decodes a BuzzwordConfig message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns BuzzwordConfig
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.BuzzwordConfig;

                        /**
                         * Verifies a BuzzwordConfig message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a BuzzwordConfig message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns BuzzwordConfig
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.BuzzwordConfig;

                        /**
                         * Creates a plain object from a BuzzwordConfig message. Also converts values to other types if specified.
                         * @param message BuzzwordConfig
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.BuzzwordConfig, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this BuzzwordConfig to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for BuzzwordConfig
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** Properties of a BuzzwordShowConfig. */
                    interface IBuzzwordShowConfig {

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
                    }

                    /** Represents a BuzzwordShowConfig. */
                    class BuzzwordShowConfig implements IBuzzwordShowConfig {

                        /**
                         * Constructs a new BuzzwordShowConfig.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.IBuzzwordShowConfig);

                        /** BuzzwordShowConfig name. */
                        public name: string;

                        /** BuzzwordShowConfig schema. */
                        public schema: string;

                        /** BuzzwordShowConfig source. */
                        public source: number;

                        /** BuzzwordShowConfig id. */
                        public id: (number|Long);

                        /** BuzzwordShowConfig buzzwordId. */
                        public buzzwordId: (number|Long);

                        /** BuzzwordShowConfig schemaType. */
                        public schemaType: number;

                        /**
                         * Creates a new BuzzwordShowConfig instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns BuzzwordShowConfig instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.IBuzzwordShowConfig): bilibili.community.service.dm.v1.BuzzwordShowConfig;

                        /**
                         * Encodes the specified BuzzwordShowConfig message. Does not implicitly {@link bilibili.community.service.dm.v1.BuzzwordShowConfig.verify|verify} messages.
                         * @param message BuzzwordShowConfig message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.IBuzzwordShowConfig, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified BuzzwordShowConfig message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.BuzzwordShowConfig.verify|verify} messages.
                         * @param message BuzzwordShowConfig message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.IBuzzwordShowConfig, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a BuzzwordShowConfig message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns BuzzwordShowConfig
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.BuzzwordShowConfig;

                        /**
                         * Decodes a BuzzwordShowConfig message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns BuzzwordShowConfig
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.BuzzwordShowConfig;

                        /**
                         * Verifies a BuzzwordShowConfig message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a BuzzwordShowConfig message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns BuzzwordShowConfig
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.BuzzwordShowConfig;

                        /**
                         * Creates a plain object from a BuzzwordShowConfig message. Also converts values to other types if specified.
                         * @param message BuzzwordShowConfig
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.BuzzwordShowConfig, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this BuzzwordShowConfig to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for BuzzwordShowConfig
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** Properties of a CheckBox. */
                    interface ICheckBox {

                        /** CheckBox text */
                        text?: (string|null);

                        /** CheckBox type */
                        type?: (bilibili.community.service.dm.v1.CheckboxType|null);

                        /** CheckBox defaultValue */
                        defaultValue?: (boolean|null);

                        /** CheckBox show */
                        show?: (boolean|null);
                    }

                    /** Represents a CheckBox. */
                    class CheckBox implements ICheckBox {

                        /**
                         * Constructs a new CheckBox.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.ICheckBox);

                        /** CheckBox text. */
                        public text: string;

                        /** CheckBox type. */
                        public type: bilibili.community.service.dm.v1.CheckboxType;

                        /** CheckBox defaultValue. */
                        public defaultValue: boolean;

                        /** CheckBox show. */
                        public show: boolean;

                        /**
                         * Creates a new CheckBox instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns CheckBox instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.ICheckBox): bilibili.community.service.dm.v1.CheckBox;

                        /**
                         * Encodes the specified CheckBox message. Does not implicitly {@link bilibili.community.service.dm.v1.CheckBox.verify|verify} messages.
                         * @param message CheckBox message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.ICheckBox, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified CheckBox message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.CheckBox.verify|verify} messages.
                         * @param message CheckBox message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.ICheckBox, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a CheckBox message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns CheckBox
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.CheckBox;

                        /**
                         * Decodes a CheckBox message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns CheckBox
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.CheckBox;

                        /**
                         * Verifies a CheckBox message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a CheckBox message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns CheckBox
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.CheckBox;

                        /**
                         * Creates a plain object from a CheckBox message. Also converts values to other types if specified.
                         * @param message CheckBox
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.CheckBox, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this CheckBox to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for CheckBox
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** CheckboxType enum. */
                    enum CheckboxType {
                        CheckboxTypeNone = 0,
                        CheckboxTypeEncourage = 1,
                        CheckboxTypeColorDM = 2
                    }

                    /** Properties of a CheckBoxV2. */
                    interface ICheckBoxV2 {

                        /** CheckBoxV2 text */
                        text?: (string|null);

                        /** CheckBoxV2 type */
                        type?: (number|null);

                        /** CheckBoxV2 defaultValue */
                        defaultValue?: (boolean|null);
                    }

                    /** Represents a CheckBoxV2. */
                    class CheckBoxV2 implements ICheckBoxV2 {

                        /**
                         * Constructs a new CheckBoxV2.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.ICheckBoxV2);

                        /** CheckBoxV2 text. */
                        public text: string;

                        /** CheckBoxV2 type. */
                        public type: number;

                        /** CheckBoxV2 defaultValue. */
                        public defaultValue: boolean;

                        /**
                         * Creates a new CheckBoxV2 instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns CheckBoxV2 instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.ICheckBoxV2): bilibili.community.service.dm.v1.CheckBoxV2;

                        /**
                         * Encodes the specified CheckBoxV2 message. Does not implicitly {@link bilibili.community.service.dm.v1.CheckBoxV2.verify|verify} messages.
                         * @param message CheckBoxV2 message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.ICheckBoxV2, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified CheckBoxV2 message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.CheckBoxV2.verify|verify} messages.
                         * @param message CheckBoxV2 message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.ICheckBoxV2, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a CheckBoxV2 message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns CheckBoxV2
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.CheckBoxV2;

                        /**
                         * Decodes a CheckBoxV2 message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns CheckBoxV2
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.CheckBoxV2;

                        /**
                         * Verifies a CheckBoxV2 message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a CheckBoxV2 message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns CheckBoxV2
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.CheckBoxV2;

                        /**
                         * Creates a plain object from a CheckBoxV2 message. Also converts values to other types if specified.
                         * @param message CheckBoxV2
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.CheckBoxV2, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this CheckBoxV2 to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for CheckBoxV2
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** Properties of a ClickButton. */
                    interface IClickButton {

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
                        bubble?: (bilibili.community.service.dm.v1.IBubble|null);
                    }

                    /** Represents a ClickButton. */
                    class ClickButton implements IClickButton {

                        /**
                         * Constructs a new ClickButton.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.IClickButton);

                        /** ClickButton portraitText. */
                        public portraitText: string[];

                        /** ClickButton landscapeText. */
                        public landscapeText: string[];

                        /** ClickButton portraitTextFocus. */
                        public portraitTextFocus: string[];

                        /** ClickButton landscapeTextFocus. */
                        public landscapeTextFocus: string[];

                        /** ClickButton renderType. */
                        public renderType: bilibili.community.service.dm.v1.RenderType;

                        /** ClickButton show. */
                        public show: boolean;

                        /** ClickButton bubble. */
                        public bubble?: (bilibili.community.service.dm.v1.IBubble|null);

                        /**
                         * Creates a new ClickButton instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns ClickButton instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.IClickButton): bilibili.community.service.dm.v1.ClickButton;

                        /**
                         * Encodes the specified ClickButton message. Does not implicitly {@link bilibili.community.service.dm.v1.ClickButton.verify|verify} messages.
                         * @param message ClickButton message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.IClickButton, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified ClickButton message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.ClickButton.verify|verify} messages.
                         * @param message ClickButton message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.IClickButton, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a ClickButton message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns ClickButton
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.ClickButton;

                        /**
                         * Decodes a ClickButton message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns ClickButton
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.ClickButton;

                        /**
                         * Verifies a ClickButton message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a ClickButton message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns ClickButton
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.ClickButton;

                        /**
                         * Creates a plain object from a ClickButton message. Also converts values to other types if specified.
                         * @param message ClickButton
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.ClickButton, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this ClickButton to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for ClickButton
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** Properties of a ClickButtonV2. */
                    interface IClickButtonV2 {

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
                    }

                    /** Represents a ClickButtonV2. */
                    class ClickButtonV2 implements IClickButtonV2 {

                        /**
                         * Constructs a new ClickButtonV2.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.IClickButtonV2);

                        /** ClickButtonV2 portraitText. */
                        public portraitText: string[];

                        /** ClickButtonV2 landscapeText. */
                        public landscapeText: string[];

                        /** ClickButtonV2 portraitTextFocus. */
                        public portraitTextFocus: string[];

                        /** ClickButtonV2 landscapeTextFocus. */
                        public landscapeTextFocus: string[];

                        /** ClickButtonV2 renderType. */
                        public renderType: number;

                        /** ClickButtonV2 textInputPost. */
                        public textInputPost: boolean;

                        /** ClickButtonV2 exposureOnce. */
                        public exposureOnce: boolean;

                        /** ClickButtonV2 exposureType. */
                        public exposureType: number;

                        /**
                         * Creates a new ClickButtonV2 instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns ClickButtonV2 instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.IClickButtonV2): bilibili.community.service.dm.v1.ClickButtonV2;

                        /**
                         * Encodes the specified ClickButtonV2 message. Does not implicitly {@link bilibili.community.service.dm.v1.ClickButtonV2.verify|verify} messages.
                         * @param message ClickButtonV2 message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.IClickButtonV2, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified ClickButtonV2 message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.ClickButtonV2.verify|verify} messages.
                         * @param message ClickButtonV2 message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.IClickButtonV2, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a ClickButtonV2 message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns ClickButtonV2
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.ClickButtonV2;

                        /**
                         * Decodes a ClickButtonV2 message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns ClickButtonV2
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.ClickButtonV2;

                        /**
                         * Verifies a ClickButtonV2 message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a ClickButtonV2 message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns ClickButtonV2
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.ClickButtonV2;

                        /**
                         * Creates a plain object from a ClickButtonV2 message. Also converts values to other types if specified.
                         * @param message ClickButtonV2
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.ClickButtonV2, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this ClickButtonV2 to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for ClickButtonV2
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** Properties of a CommandDm. */
                    interface ICommandDm {

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
                    }

                    /** Represents a CommandDm. */
                    class CommandDm implements ICommandDm {

                        /**
                         * Constructs a new CommandDm.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.ICommandDm);

                        /** CommandDm id. */
                        public id: (number|Long);

                        /** CommandDm oid. */
                        public oid: (number|Long);

                        /** CommandDm mid. */
                        public mid: string;

                        /** CommandDm command. */
                        public command: string;

                        /** CommandDm content. */
                        public content: string;

                        /** CommandDm progress. */
                        public progress: number;

                        /** CommandDm ctime. */
                        public ctime: string;

                        /** CommandDm mtime. */
                        public mtime: string;

                        /** CommandDm extra. */
                        public extra: string;

                        /** CommandDm idStr. */
                        public idStr: string;

                        /**
                         * Creates a new CommandDm instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns CommandDm instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.ICommandDm): bilibili.community.service.dm.v1.CommandDm;

                        /**
                         * Encodes the specified CommandDm message. Does not implicitly {@link bilibili.community.service.dm.v1.CommandDm.verify|verify} messages.
                         * @param message CommandDm message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.ICommandDm, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified CommandDm message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.CommandDm.verify|verify} messages.
                         * @param message CommandDm message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.ICommandDm, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a CommandDm message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns CommandDm
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.CommandDm;

                        /**
                         * Decodes a CommandDm message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns CommandDm
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.CommandDm;

                        /**
                         * Verifies a CommandDm message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a CommandDm message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns CommandDm
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.CommandDm;

                        /**
                         * Creates a plain object from a CommandDm message. Also converts values to other types if specified.
                         * @param message CommandDm
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.CommandDm, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this CommandDm to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for CommandDm
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** Properties of a DanmakuAIFlag. */
                    interface IDanmakuAIFlag {

                        /** DanmakuAIFlag dmFlags */
                        dmFlags?: (bilibili.community.service.dm.v1.IDanmakuFlag[]|null);
                    }

                    /** Represents a DanmakuAIFlag. */
                    class DanmakuAIFlag implements IDanmakuAIFlag {

                        /**
                         * Constructs a new DanmakuAIFlag.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.IDanmakuAIFlag);

                        /** DanmakuAIFlag dmFlags. */
                        public dmFlags: bilibili.community.service.dm.v1.IDanmakuFlag[];

                        /**
                         * Creates a new DanmakuAIFlag instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns DanmakuAIFlag instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.IDanmakuAIFlag): bilibili.community.service.dm.v1.DanmakuAIFlag;

                        /**
                         * Encodes the specified DanmakuAIFlag message. Does not implicitly {@link bilibili.community.service.dm.v1.DanmakuAIFlag.verify|verify} messages.
                         * @param message DanmakuAIFlag message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.IDanmakuAIFlag, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified DanmakuAIFlag message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.DanmakuAIFlag.verify|verify} messages.
                         * @param message DanmakuAIFlag message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.IDanmakuAIFlag, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a DanmakuAIFlag message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns DanmakuAIFlag
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.DanmakuAIFlag;

                        /**
                         * Decodes a DanmakuAIFlag message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns DanmakuAIFlag
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.DanmakuAIFlag;

                        /**
                         * Verifies a DanmakuAIFlag message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a DanmakuAIFlag message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns DanmakuAIFlag
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.DanmakuAIFlag;

                        /**
                         * Creates a plain object from a DanmakuAIFlag message. Also converts values to other types if specified.
                         * @param message DanmakuAIFlag
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.DanmakuAIFlag, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this DanmakuAIFlag to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for DanmakuAIFlag
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** Properties of a DanmakuElem. */
                    interface IDanmakuElem {

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
                    }

                    /** Represents a DanmakuElem. */
                    class DanmakuElem implements IDanmakuElem {

                        /**
                         * Constructs a new DanmakuElem.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.IDanmakuElem);

                        /** DanmakuElem id. */
                        public id: (number|Long);

                        /** DanmakuElem progress. */
                        public progress: number;

                        /** DanmakuElem mode. */
                        public mode: number;

                        /** DanmakuElem fontsize. */
                        public fontsize: number;

                        /** DanmakuElem color. */
                        public color: number;

                        /** DanmakuElem midHash. */
                        public midHash: string;

                        /** DanmakuElem content. */
                        public content: string;

                        /** DanmakuElem ctime. */
                        public ctime: (number|Long);

                        /** DanmakuElem weight. */
                        public weight: number;

                        /** DanmakuElem action. */
                        public action: string;

                        /** DanmakuElem pool. */
                        public pool: number;

                        /** DanmakuElem idStr. */
                        public idStr: string;

                        /** DanmakuElem attr. */
                        public attr: number;

                        /** DanmakuElem animation. */
                        public animation: string;

                        /** DanmakuElem colorful. */
                        public colorful: bilibili.community.service.dm.v1.DmColorfulType;

                        /**
                         * Creates a new DanmakuElem instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns DanmakuElem instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.IDanmakuElem): bilibili.community.service.dm.v1.DanmakuElem;

                        /**
                         * Encodes the specified DanmakuElem message. Does not implicitly {@link bilibili.community.service.dm.v1.DanmakuElem.verify|verify} messages.
                         * @param message DanmakuElem message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.IDanmakuElem, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified DanmakuElem message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.DanmakuElem.verify|verify} messages.
                         * @param message DanmakuElem message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.IDanmakuElem, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a DanmakuElem message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns DanmakuElem
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.DanmakuElem;

                        /**
                         * Decodes a DanmakuElem message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns DanmakuElem
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.DanmakuElem;

                        /**
                         * Verifies a DanmakuElem message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a DanmakuElem message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns DanmakuElem
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.DanmakuElem;

                        /**
                         * Creates a plain object from a DanmakuElem message. Also converts values to other types if specified.
                         * @param message DanmakuElem
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.DanmakuElem, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this DanmakuElem to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for DanmakuElem
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** Properties of a DanmakuFlag. */
                    interface IDanmakuFlag {

                        /** DanmakuFlag dmid */
                        dmid?: (number|Long|null);

                        /** DanmakuFlag flag */
                        flag?: (number|null);
                    }

                    /** Represents a DanmakuFlag. */
                    class DanmakuFlag implements IDanmakuFlag {

                        /**
                         * Constructs a new DanmakuFlag.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.IDanmakuFlag);

                        /** DanmakuFlag dmid. */
                        public dmid: (number|Long);

                        /** DanmakuFlag flag. */
                        public flag: number;

                        /**
                         * Creates a new DanmakuFlag instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns DanmakuFlag instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.IDanmakuFlag): bilibili.community.service.dm.v1.DanmakuFlag;

                        /**
                         * Encodes the specified DanmakuFlag message. Does not implicitly {@link bilibili.community.service.dm.v1.DanmakuFlag.verify|verify} messages.
                         * @param message DanmakuFlag message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.IDanmakuFlag, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified DanmakuFlag message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.DanmakuFlag.verify|verify} messages.
                         * @param message DanmakuFlag message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.IDanmakuFlag, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a DanmakuFlag message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns DanmakuFlag
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.DanmakuFlag;

                        /**
                         * Decodes a DanmakuFlag message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns DanmakuFlag
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.DanmakuFlag;

                        /**
                         * Verifies a DanmakuFlag message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a DanmakuFlag message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns DanmakuFlag
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.DanmakuFlag;

                        /**
                         * Creates a plain object from a DanmakuFlag message. Also converts values to other types if specified.
                         * @param message DanmakuFlag
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.DanmakuFlag, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this DanmakuFlag to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for DanmakuFlag
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** Properties of a DanmakuFlagConfig. */
                    interface IDanmakuFlagConfig {

                        /** DanmakuFlagConfig recFlag */
                        recFlag?: (number|null);

                        /** DanmakuFlagConfig recText */
                        recText?: (string|null);

                        /** DanmakuFlagConfig recSwitch */
                        recSwitch?: (number|null);
                    }

                    /** Represents a DanmakuFlagConfig. */
                    class DanmakuFlagConfig implements IDanmakuFlagConfig {

                        /**
                         * Constructs a new DanmakuFlagConfig.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.IDanmakuFlagConfig);

                        /** DanmakuFlagConfig recFlag. */
                        public recFlag: number;

                        /** DanmakuFlagConfig recText. */
                        public recText: string;

                        /** DanmakuFlagConfig recSwitch. */
                        public recSwitch: number;

                        /**
                         * Creates a new DanmakuFlagConfig instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns DanmakuFlagConfig instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.IDanmakuFlagConfig): bilibili.community.service.dm.v1.DanmakuFlagConfig;

                        /**
                         * Encodes the specified DanmakuFlagConfig message. Does not implicitly {@link bilibili.community.service.dm.v1.DanmakuFlagConfig.verify|verify} messages.
                         * @param message DanmakuFlagConfig message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.IDanmakuFlagConfig, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified DanmakuFlagConfig message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.DanmakuFlagConfig.verify|verify} messages.
                         * @param message DanmakuFlagConfig message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.IDanmakuFlagConfig, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a DanmakuFlagConfig message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns DanmakuFlagConfig
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.DanmakuFlagConfig;

                        /**
                         * Decodes a DanmakuFlagConfig message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns DanmakuFlagConfig
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.DanmakuFlagConfig;

                        /**
                         * Verifies a DanmakuFlagConfig message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a DanmakuFlagConfig message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns DanmakuFlagConfig
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.DanmakuFlagConfig;

                        /**
                         * Creates a plain object from a DanmakuFlagConfig message. Also converts values to other types if specified.
                         * @param message DanmakuFlagConfig
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.DanmakuFlagConfig, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this DanmakuFlagConfig to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for DanmakuFlagConfig
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** Properties of a DanmuDefaultPlayerConfig. */
                    interface IDanmuDefaultPlayerConfig {

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
                    }

                    /** Represents a DanmuDefaultPlayerConfig. */
                    class DanmuDefaultPlayerConfig implements IDanmuDefaultPlayerConfig {

                        /**
                         * Constructs a new DanmuDefaultPlayerConfig.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.IDanmuDefaultPlayerConfig);

                        /** DanmuDefaultPlayerConfig playerDanmakuUseDefaultConfig. */
                        public playerDanmakuUseDefaultConfig: boolean;

                        /** DanmuDefaultPlayerConfig playerDanmakuAiRecommendedSwitch. */
                        public playerDanmakuAiRecommendedSwitch: boolean;

                        /** DanmuDefaultPlayerConfig playerDanmakuAiRecommendedLevel. */
                        public playerDanmakuAiRecommendedLevel: number;

                        /** DanmuDefaultPlayerConfig playerDanmakuBlocktop. */
                        public playerDanmakuBlocktop: boolean;

                        /** DanmuDefaultPlayerConfig playerDanmakuBlockscroll. */
                        public playerDanmakuBlockscroll: boolean;

                        /** DanmuDefaultPlayerConfig playerDanmakuBlockbottom. */
                        public playerDanmakuBlockbottom: boolean;

                        /** DanmuDefaultPlayerConfig playerDanmakuBlockcolorful. */
                        public playerDanmakuBlockcolorful: boolean;

                        /** DanmuDefaultPlayerConfig playerDanmakuBlockrepeat. */
                        public playerDanmakuBlockrepeat: boolean;

                        /** DanmuDefaultPlayerConfig playerDanmakuBlockspecial. */
                        public playerDanmakuBlockspecial: boolean;

                        /** DanmuDefaultPlayerConfig playerDanmakuOpacity. */
                        public playerDanmakuOpacity: number;

                        /** DanmuDefaultPlayerConfig playerDanmakuScalingfactor. */
                        public playerDanmakuScalingfactor: number;

                        /** DanmuDefaultPlayerConfig playerDanmakuDomain. */
                        public playerDanmakuDomain: number;

                        /** DanmuDefaultPlayerConfig playerDanmakuSpeed. */
                        public playerDanmakuSpeed: number;

                        /** DanmuDefaultPlayerConfig inlinePlayerDanmakuSwitch. */
                        public inlinePlayerDanmakuSwitch: boolean;

                        /** DanmuDefaultPlayerConfig playerDanmakuSeniorModeSwitch. */
                        public playerDanmakuSeniorModeSwitch: number;

                        /** DanmuDefaultPlayerConfig playerDanmakuAiRecommendedLevelV2. */
                        public playerDanmakuAiRecommendedLevelV2: number;

                        /** DanmuDefaultPlayerConfig playerDanmakuAiRecommendedLevelV2Map. */
                        public playerDanmakuAiRecommendedLevelV2Map: { [k: string]: number };

                        /**
                         * Creates a new DanmuDefaultPlayerConfig instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns DanmuDefaultPlayerConfig instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.IDanmuDefaultPlayerConfig): bilibili.community.service.dm.v1.DanmuDefaultPlayerConfig;

                        /**
                         * Encodes the specified DanmuDefaultPlayerConfig message. Does not implicitly {@link bilibili.community.service.dm.v1.DanmuDefaultPlayerConfig.verify|verify} messages.
                         * @param message DanmuDefaultPlayerConfig message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.IDanmuDefaultPlayerConfig, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified DanmuDefaultPlayerConfig message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.DanmuDefaultPlayerConfig.verify|verify} messages.
                         * @param message DanmuDefaultPlayerConfig message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.IDanmuDefaultPlayerConfig, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a DanmuDefaultPlayerConfig message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns DanmuDefaultPlayerConfig
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.DanmuDefaultPlayerConfig;

                        /**
                         * Decodes a DanmuDefaultPlayerConfig message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns DanmuDefaultPlayerConfig
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.DanmuDefaultPlayerConfig;

                        /**
                         * Verifies a DanmuDefaultPlayerConfig message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a DanmuDefaultPlayerConfig message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns DanmuDefaultPlayerConfig
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.DanmuDefaultPlayerConfig;

                        /**
                         * Creates a plain object from a DanmuDefaultPlayerConfig message. Also converts values to other types if specified.
                         * @param message DanmuDefaultPlayerConfig
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.DanmuDefaultPlayerConfig, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this DanmuDefaultPlayerConfig to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for DanmuDefaultPlayerConfig
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** Properties of a DanmuPlayerConfig. */
                    interface IDanmuPlayerConfig {

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
                    }

                    /** Represents a DanmuPlayerConfig. */
                    class DanmuPlayerConfig implements IDanmuPlayerConfig {

                        /**
                         * Constructs a new DanmuPlayerConfig.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.IDanmuPlayerConfig);

                        /** DanmuPlayerConfig playerDanmakuSwitch. */
                        public playerDanmakuSwitch: boolean;

                        /** DanmuPlayerConfig playerDanmakuSwitchSave. */
                        public playerDanmakuSwitchSave: boolean;

                        /** DanmuPlayerConfig playerDanmakuUseDefaultConfig. */
                        public playerDanmakuUseDefaultConfig: boolean;

                        /** DanmuPlayerConfig playerDanmakuAiRecommendedSwitch. */
                        public playerDanmakuAiRecommendedSwitch: boolean;

                        /** DanmuPlayerConfig playerDanmakuAiRecommendedLevel. */
                        public playerDanmakuAiRecommendedLevel: number;

                        /** DanmuPlayerConfig playerDanmakuBlocktop. */
                        public playerDanmakuBlocktop: boolean;

                        /** DanmuPlayerConfig playerDanmakuBlockscroll. */
                        public playerDanmakuBlockscroll: boolean;

                        /** DanmuPlayerConfig playerDanmakuBlockbottom. */
                        public playerDanmakuBlockbottom: boolean;

                        /** DanmuPlayerConfig playerDanmakuBlockcolorful. */
                        public playerDanmakuBlockcolorful: boolean;

                        /** DanmuPlayerConfig playerDanmakuBlockrepeat. */
                        public playerDanmakuBlockrepeat: boolean;

                        /** DanmuPlayerConfig playerDanmakuBlockspecial. */
                        public playerDanmakuBlockspecial: boolean;

                        /** DanmuPlayerConfig playerDanmakuOpacity. */
                        public playerDanmakuOpacity: number;

                        /** DanmuPlayerConfig playerDanmakuScalingfactor. */
                        public playerDanmakuScalingfactor: number;

                        /** DanmuPlayerConfig playerDanmakuDomain. */
                        public playerDanmakuDomain: number;

                        /** DanmuPlayerConfig playerDanmakuSpeed. */
                        public playerDanmakuSpeed: number;

                        /** DanmuPlayerConfig playerDanmakuEnableblocklist. */
                        public playerDanmakuEnableblocklist: boolean;

                        /** DanmuPlayerConfig inlinePlayerDanmakuSwitch. */
                        public inlinePlayerDanmakuSwitch: boolean;

                        /** DanmuPlayerConfig inlinePlayerDanmakuConfig. */
                        public inlinePlayerDanmakuConfig: number;

                        /** DanmuPlayerConfig playerDanmakuIosSwitchSave. */
                        public playerDanmakuIosSwitchSave: number;

                        /** DanmuPlayerConfig playerDanmakuSeniorModeSwitch. */
                        public playerDanmakuSeniorModeSwitch: number;

                        /** DanmuPlayerConfig playerDanmakuAiRecommendedLevelV2. */
                        public playerDanmakuAiRecommendedLevelV2: number;

                        /** DanmuPlayerConfig playerDanmakuAiRecommendedLevelV2Map. */
                        public playerDanmakuAiRecommendedLevelV2Map: { [k: string]: number };

                        /**
                         * Creates a new DanmuPlayerConfig instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns DanmuPlayerConfig instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.IDanmuPlayerConfig): bilibili.community.service.dm.v1.DanmuPlayerConfig;

                        /**
                         * Encodes the specified DanmuPlayerConfig message. Does not implicitly {@link bilibili.community.service.dm.v1.DanmuPlayerConfig.verify|verify} messages.
                         * @param message DanmuPlayerConfig message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.IDanmuPlayerConfig, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified DanmuPlayerConfig message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.DanmuPlayerConfig.verify|verify} messages.
                         * @param message DanmuPlayerConfig message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.IDanmuPlayerConfig, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a DanmuPlayerConfig message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns DanmuPlayerConfig
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.DanmuPlayerConfig;

                        /**
                         * Decodes a DanmuPlayerConfig message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns DanmuPlayerConfig
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.DanmuPlayerConfig;

                        /**
                         * Verifies a DanmuPlayerConfig message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a DanmuPlayerConfig message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns DanmuPlayerConfig
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.DanmuPlayerConfig;

                        /**
                         * Creates a plain object from a DanmuPlayerConfig message. Also converts values to other types if specified.
                         * @param message DanmuPlayerConfig
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.DanmuPlayerConfig, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this DanmuPlayerConfig to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for DanmuPlayerConfig
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** Properties of a DanmuPlayerConfigPanel. */
                    interface IDanmuPlayerConfigPanel {

                        /** DanmuPlayerConfigPanel selectionText */
                        selectionText?: (string|null);
                    }

                    /** Represents a DanmuPlayerConfigPanel. */
                    class DanmuPlayerConfigPanel implements IDanmuPlayerConfigPanel {

                        /**
                         * Constructs a new DanmuPlayerConfigPanel.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.IDanmuPlayerConfigPanel);

                        /** DanmuPlayerConfigPanel selectionText. */
                        public selectionText: string;

                        /**
                         * Creates a new DanmuPlayerConfigPanel instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns DanmuPlayerConfigPanel instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.IDanmuPlayerConfigPanel): bilibili.community.service.dm.v1.DanmuPlayerConfigPanel;

                        /**
                         * Encodes the specified DanmuPlayerConfigPanel message. Does not implicitly {@link bilibili.community.service.dm.v1.DanmuPlayerConfigPanel.verify|verify} messages.
                         * @param message DanmuPlayerConfigPanel message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.IDanmuPlayerConfigPanel, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified DanmuPlayerConfigPanel message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.DanmuPlayerConfigPanel.verify|verify} messages.
                         * @param message DanmuPlayerConfigPanel message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.IDanmuPlayerConfigPanel, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a DanmuPlayerConfigPanel message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns DanmuPlayerConfigPanel
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.DanmuPlayerConfigPanel;

                        /**
                         * Decodes a DanmuPlayerConfigPanel message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns DanmuPlayerConfigPanel
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.DanmuPlayerConfigPanel;

                        /**
                         * Verifies a DanmuPlayerConfigPanel message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a DanmuPlayerConfigPanel message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns DanmuPlayerConfigPanel
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.DanmuPlayerConfigPanel;

                        /**
                         * Creates a plain object from a DanmuPlayerConfigPanel message. Also converts values to other types if specified.
                         * @param message DanmuPlayerConfigPanel
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.DanmuPlayerConfigPanel, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this DanmuPlayerConfigPanel to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for DanmuPlayerConfigPanel
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** Properties of a DanmuPlayerDynamicConfig. */
                    interface IDanmuPlayerDynamicConfig {

                        /** DanmuPlayerDynamicConfig progress */
                        progress?: (number|null);

                        /** DanmuPlayerDynamicConfig playerDanmakuDomain */
                        playerDanmakuDomain?: (number|null);
                    }

                    /** Represents a DanmuPlayerDynamicConfig. */
                    class DanmuPlayerDynamicConfig implements IDanmuPlayerDynamicConfig {

                        /**
                         * Constructs a new DanmuPlayerDynamicConfig.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.IDanmuPlayerDynamicConfig);

                        /** DanmuPlayerDynamicConfig progress. */
                        public progress: number;

                        /** DanmuPlayerDynamicConfig playerDanmakuDomain. */
                        public playerDanmakuDomain: number;

                        /**
                         * Creates a new DanmuPlayerDynamicConfig instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns DanmuPlayerDynamicConfig instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.IDanmuPlayerDynamicConfig): bilibili.community.service.dm.v1.DanmuPlayerDynamicConfig;

                        /**
                         * Encodes the specified DanmuPlayerDynamicConfig message. Does not implicitly {@link bilibili.community.service.dm.v1.DanmuPlayerDynamicConfig.verify|verify} messages.
                         * @param message DanmuPlayerDynamicConfig message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.IDanmuPlayerDynamicConfig, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified DanmuPlayerDynamicConfig message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.DanmuPlayerDynamicConfig.verify|verify} messages.
                         * @param message DanmuPlayerDynamicConfig message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.IDanmuPlayerDynamicConfig, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a DanmuPlayerDynamicConfig message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns DanmuPlayerDynamicConfig
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.DanmuPlayerDynamicConfig;

                        /**
                         * Decodes a DanmuPlayerDynamicConfig message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns DanmuPlayerDynamicConfig
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.DanmuPlayerDynamicConfig;

                        /**
                         * Verifies a DanmuPlayerDynamicConfig message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a DanmuPlayerDynamicConfig message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns DanmuPlayerDynamicConfig
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.DanmuPlayerDynamicConfig;

                        /**
                         * Creates a plain object from a DanmuPlayerDynamicConfig message. Also converts values to other types if specified.
                         * @param message DanmuPlayerDynamicConfig
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.DanmuPlayerDynamicConfig, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this DanmuPlayerDynamicConfig to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for DanmuPlayerDynamicConfig
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** Properties of a DanmuPlayerViewConfig. */
                    interface IDanmuPlayerViewConfig {

                        /** DanmuPlayerViewConfig danmukuDefaultPlayerConfig */
                        danmukuDefaultPlayerConfig?: (bilibili.community.service.dm.v1.IDanmuDefaultPlayerConfig|null);

                        /** DanmuPlayerViewConfig danmukuPlayerConfig */
                        danmukuPlayerConfig?: (bilibili.community.service.dm.v1.IDanmuPlayerConfig|null);

                        /** DanmuPlayerViewConfig danmukuPlayerDynamicConfig */
                        danmukuPlayerDynamicConfig?: (bilibili.community.service.dm.v1.IDanmuPlayerDynamicConfig[]|null);

                        /** DanmuPlayerViewConfig danmukuPlayerConfigPanel */
                        danmukuPlayerConfigPanel?: (bilibili.community.service.dm.v1.IDanmuPlayerConfigPanel|null);
                    }

                    /** Represents a DanmuPlayerViewConfig. */
                    class DanmuPlayerViewConfig implements IDanmuPlayerViewConfig {

                        /**
                         * Constructs a new DanmuPlayerViewConfig.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.IDanmuPlayerViewConfig);

                        /** DanmuPlayerViewConfig danmukuDefaultPlayerConfig. */
                        public danmukuDefaultPlayerConfig?: (bilibili.community.service.dm.v1.IDanmuDefaultPlayerConfig|null);

                        /** DanmuPlayerViewConfig danmukuPlayerConfig. */
                        public danmukuPlayerConfig?: (bilibili.community.service.dm.v1.IDanmuPlayerConfig|null);

                        /** DanmuPlayerViewConfig danmukuPlayerDynamicConfig. */
                        public danmukuPlayerDynamicConfig: bilibili.community.service.dm.v1.IDanmuPlayerDynamicConfig[];

                        /** DanmuPlayerViewConfig danmukuPlayerConfigPanel. */
                        public danmukuPlayerConfigPanel?: (bilibili.community.service.dm.v1.IDanmuPlayerConfigPanel|null);

                        /**
                         * Creates a new DanmuPlayerViewConfig instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns DanmuPlayerViewConfig instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.IDanmuPlayerViewConfig): bilibili.community.service.dm.v1.DanmuPlayerViewConfig;

                        /**
                         * Encodes the specified DanmuPlayerViewConfig message. Does not implicitly {@link bilibili.community.service.dm.v1.DanmuPlayerViewConfig.verify|verify} messages.
                         * @param message DanmuPlayerViewConfig message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.IDanmuPlayerViewConfig, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified DanmuPlayerViewConfig message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.DanmuPlayerViewConfig.verify|verify} messages.
                         * @param message DanmuPlayerViewConfig message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.IDanmuPlayerViewConfig, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a DanmuPlayerViewConfig message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns DanmuPlayerViewConfig
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.DanmuPlayerViewConfig;

                        /**
                         * Decodes a DanmuPlayerViewConfig message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns DanmuPlayerViewConfig
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.DanmuPlayerViewConfig;

                        /**
                         * Verifies a DanmuPlayerViewConfig message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a DanmuPlayerViewConfig message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns DanmuPlayerViewConfig
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.DanmuPlayerViewConfig;

                        /**
                         * Creates a plain object from a DanmuPlayerViewConfig message. Also converts values to other types if specified.
                         * @param message DanmuPlayerViewConfig
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.DanmuPlayerViewConfig, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this DanmuPlayerViewConfig to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for DanmuPlayerViewConfig
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** Properties of a DanmuWebPlayerConfig. */
                    interface IDanmuWebPlayerConfig {

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
                    }

                    /** Represents a DanmuWebPlayerConfig. */
                    class DanmuWebPlayerConfig implements IDanmuWebPlayerConfig {

                        /**
                         * Constructs a new DanmuWebPlayerConfig.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.IDanmuWebPlayerConfig);

                        /** DanmuWebPlayerConfig dmSwitch. */
                        public dmSwitch: boolean;

                        /** DanmuWebPlayerConfig aiSwitch. */
                        public aiSwitch: boolean;

                        /** DanmuWebPlayerConfig aiLevel. */
                        public aiLevel: number;

                        /** DanmuWebPlayerConfig blocktop. */
                        public blocktop: boolean;

                        /** DanmuWebPlayerConfig blockscroll. */
                        public blockscroll: boolean;

                        /** DanmuWebPlayerConfig blockbottom. */
                        public blockbottom: boolean;

                        /** DanmuWebPlayerConfig blockcolor. */
                        public blockcolor: boolean;

                        /** DanmuWebPlayerConfig blockspecial. */
                        public blockspecial: boolean;

                        /** DanmuWebPlayerConfig preventshade. */
                        public preventshade: boolean;

                        /** DanmuWebPlayerConfig dmask. */
                        public dmask: boolean;

                        /** DanmuWebPlayerConfig opacity. */
                        public opacity: number;

                        /** DanmuWebPlayerConfig dmarea. */
                        public dmarea: number;

                        /** DanmuWebPlayerConfig speedplus. */
                        public speedplus: number;

                        /** DanmuWebPlayerConfig fontsize. */
                        public fontsize: number;

                        /** DanmuWebPlayerConfig screensync. */
                        public screensync: boolean;

                        /** DanmuWebPlayerConfig speedsync. */
                        public speedsync: boolean;

                        /** DanmuWebPlayerConfig fontfamily. */
                        public fontfamily: string;

                        /** DanmuWebPlayerConfig bold. */
                        public bold: boolean;

                        /** DanmuWebPlayerConfig fontborder. */
                        public fontborder: number;

                        /** DanmuWebPlayerConfig drawType. */
                        public drawType: string;

                        /** DanmuWebPlayerConfig seniorModeSwitch. */
                        public seniorModeSwitch: number;

                        /** DanmuWebPlayerConfig aiLevelV2. */
                        public aiLevelV2: number;

                        /** DanmuWebPlayerConfig aiLevelV2Map. */
                        public aiLevelV2Map: { [k: string]: number };

                        /**
                         * Creates a new DanmuWebPlayerConfig instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns DanmuWebPlayerConfig instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.IDanmuWebPlayerConfig): bilibili.community.service.dm.v1.DanmuWebPlayerConfig;

                        /**
                         * Encodes the specified DanmuWebPlayerConfig message. Does not implicitly {@link bilibili.community.service.dm.v1.DanmuWebPlayerConfig.verify|verify} messages.
                         * @param message DanmuWebPlayerConfig message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.IDanmuWebPlayerConfig, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified DanmuWebPlayerConfig message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.DanmuWebPlayerConfig.verify|verify} messages.
                         * @param message DanmuWebPlayerConfig message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.IDanmuWebPlayerConfig, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a DanmuWebPlayerConfig message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns DanmuWebPlayerConfig
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.DanmuWebPlayerConfig;

                        /**
                         * Decodes a DanmuWebPlayerConfig message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns DanmuWebPlayerConfig
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.DanmuWebPlayerConfig;

                        /**
                         * Verifies a DanmuWebPlayerConfig message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a DanmuWebPlayerConfig message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns DanmuWebPlayerConfig
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.DanmuWebPlayerConfig;

                        /**
                         * Creates a plain object from a DanmuWebPlayerConfig message. Also converts values to other types if specified.
                         * @param message DanmuWebPlayerConfig
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.DanmuWebPlayerConfig, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this DanmuWebPlayerConfig to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for DanmuWebPlayerConfig
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** DMAttrBit enum. */
                    enum DMAttrBit {
                        DMAttrBitProtect = 0,
                        DMAttrBitFromLive = 1,
                        DMAttrHighLike = 2
                    }

                    /** Properties of a DmColorful. */
                    interface IDmColorful {

                        /** DmColorful type */
                        type?: (bilibili.community.service.dm.v1.DmColorfulType|null);

                        /** DmColorful src */
                        src?: (string|null);
                    }

                    /** Represents a DmColorful. */
                    class DmColorful implements IDmColorful {

                        /**
                         * Constructs a new DmColorful.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.IDmColorful);

                        /** DmColorful type. */
                        public type: bilibili.community.service.dm.v1.DmColorfulType;

                        /** DmColorful src. */
                        public src: string;

                        /**
                         * Creates a new DmColorful instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns DmColorful instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.IDmColorful): bilibili.community.service.dm.v1.DmColorful;

                        /**
                         * Encodes the specified DmColorful message. Does not implicitly {@link bilibili.community.service.dm.v1.DmColorful.verify|verify} messages.
                         * @param message DmColorful message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.IDmColorful, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified DmColorful message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.DmColorful.verify|verify} messages.
                         * @param message DmColorful message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.IDmColorful, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a DmColorful message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns DmColorful
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.DmColorful;

                        /**
                         * Decodes a DmColorful message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns DmColorful
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.DmColorful;

                        /**
                         * Verifies a DmColorful message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a DmColorful message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns DmColorful
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.DmColorful;

                        /**
                         * Creates a plain object from a DmColorful message. Also converts values to other types if specified.
                         * @param message DmColorful
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.DmColorful, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this DmColorful to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for DmColorful
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** DmColorfulType enum. */
                    enum DmColorfulType {
                        NoneType = 0,
                        VipGradualColor = 60001
                    }

                    /** Properties of a DmExpoReportReq. */
                    interface IDmExpoReportReq {

                        /** DmExpoReportReq sessionId */
                        sessionId?: (string|null);

                        /** DmExpoReportReq oid */
                        oid?: (number|Long|null);

                        /** DmExpoReportReq spmid */
                        spmid?: (string|null);
                    }

                    /** Represents a DmExpoReportReq. */
                    class DmExpoReportReq implements IDmExpoReportReq {

                        /**
                         * Constructs a new DmExpoReportReq.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.IDmExpoReportReq);

                        /** DmExpoReportReq sessionId. */
                        public sessionId: string;

                        /** DmExpoReportReq oid. */
                        public oid: (number|Long);

                        /** DmExpoReportReq spmid. */
                        public spmid: string;

                        /**
                         * Creates a new DmExpoReportReq instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns DmExpoReportReq instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.IDmExpoReportReq): bilibili.community.service.dm.v1.DmExpoReportReq;

                        /**
                         * Encodes the specified DmExpoReportReq message. Does not implicitly {@link bilibili.community.service.dm.v1.DmExpoReportReq.verify|verify} messages.
                         * @param message DmExpoReportReq message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.IDmExpoReportReq, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified DmExpoReportReq message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.DmExpoReportReq.verify|verify} messages.
                         * @param message DmExpoReportReq message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.IDmExpoReportReq, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a DmExpoReportReq message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns DmExpoReportReq
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.DmExpoReportReq;

                        /**
                         * Decodes a DmExpoReportReq message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns DmExpoReportReq
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.DmExpoReportReq;

                        /**
                         * Verifies a DmExpoReportReq message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a DmExpoReportReq message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns DmExpoReportReq
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.DmExpoReportReq;

                        /**
                         * Creates a plain object from a DmExpoReportReq message. Also converts values to other types if specified.
                         * @param message DmExpoReportReq
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.DmExpoReportReq, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this DmExpoReportReq to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for DmExpoReportReq
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** Properties of a DmExpoReportRes. */
                    interface IDmExpoReportRes {
                    }

                    /** Represents a DmExpoReportRes. */
                    class DmExpoReportRes implements IDmExpoReportRes {

                        /**
                         * Constructs a new DmExpoReportRes.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.IDmExpoReportRes);

                        /**
                         * Creates a new DmExpoReportRes instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns DmExpoReportRes instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.IDmExpoReportRes): bilibili.community.service.dm.v1.DmExpoReportRes;

                        /**
                         * Encodes the specified DmExpoReportRes message. Does not implicitly {@link bilibili.community.service.dm.v1.DmExpoReportRes.verify|verify} messages.
                         * @param message DmExpoReportRes message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.IDmExpoReportRes, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified DmExpoReportRes message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.DmExpoReportRes.verify|verify} messages.
                         * @param message DmExpoReportRes message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.IDmExpoReportRes, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a DmExpoReportRes message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns DmExpoReportRes
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.DmExpoReportRes;

                        /**
                         * Decodes a DmExpoReportRes message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns DmExpoReportRes
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.DmExpoReportRes;

                        /**
                         * Verifies a DmExpoReportRes message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a DmExpoReportRes message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns DmExpoReportRes
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.DmExpoReportRes;

                        /**
                         * Creates a plain object from a DmExpoReportRes message. Also converts values to other types if specified.
                         * @param message DmExpoReportRes
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.DmExpoReportRes, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this DmExpoReportRes to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for DmExpoReportRes
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** Properties of a DmPlayerConfigReq. */
                    interface IDmPlayerConfigReq {

                        /** DmPlayerConfigReq ts */
                        ts?: (number|Long|null);

                        /** DmPlayerConfigReq switch */
                        "switch"?: (bilibili.community.service.dm.v1.IPlayerDanmakuSwitch|null);

                        /** DmPlayerConfigReq switchSave */
                        switchSave?: (bilibili.community.service.dm.v1.IPlayerDanmakuSwitchSave|null);

                        /** DmPlayerConfigReq useDefaultConfig */
                        useDefaultConfig?: (bilibili.community.service.dm.v1.IPlayerDanmakuUseDefaultConfig|null);

                        /** DmPlayerConfigReq aiRecommendedSwitch */
                        aiRecommendedSwitch?: (bilibili.community.service.dm.v1.IPlayerDanmakuAiRecommendedSwitch|null);

                        /** DmPlayerConfigReq aiRecommendedLevel */
                        aiRecommendedLevel?: (bilibili.community.service.dm.v1.IPlayerDanmakuAiRecommendedLevel|null);

                        /** DmPlayerConfigReq blocktop */
                        blocktop?: (bilibili.community.service.dm.v1.IPlayerDanmakuBlocktop|null);

                        /** DmPlayerConfigReq blockscroll */
                        blockscroll?: (bilibili.community.service.dm.v1.IPlayerDanmakuBlockscroll|null);

                        /** DmPlayerConfigReq blockbottom */
                        blockbottom?: (bilibili.community.service.dm.v1.IPlayerDanmakuBlockbottom|null);

                        /** DmPlayerConfigReq blockcolorful */
                        blockcolorful?: (bilibili.community.service.dm.v1.IPlayerDanmakuBlockcolorful|null);

                        /** DmPlayerConfigReq blockrepeat */
                        blockrepeat?: (bilibili.community.service.dm.v1.IPlayerDanmakuBlockrepeat|null);

                        /** DmPlayerConfigReq blockspecial */
                        blockspecial?: (bilibili.community.service.dm.v1.IPlayerDanmakuBlockspecial|null);

                        /** DmPlayerConfigReq opacity */
                        opacity?: (bilibili.community.service.dm.v1.IPlayerDanmakuOpacity|null);

                        /** DmPlayerConfigReq scalingfactor */
                        scalingfactor?: (bilibili.community.service.dm.v1.IPlayerDanmakuScalingfactor|null);

                        /** DmPlayerConfigReq domain */
                        domain?: (bilibili.community.service.dm.v1.IPlayerDanmakuDomain|null);

                        /** DmPlayerConfigReq speed */
                        speed?: (bilibili.community.service.dm.v1.IPlayerDanmakuSpeed|null);

                        /** DmPlayerConfigReq enableblocklist */
                        enableblocklist?: (bilibili.community.service.dm.v1.IPlayerDanmakuEnableblocklist|null);

                        /** DmPlayerConfigReq inlinePlayerDanmakuSwitch */
                        inlinePlayerDanmakuSwitch?: (bilibili.community.service.dm.v1.IInlinePlayerDanmakuSwitch|null);

                        /** DmPlayerConfigReq seniorModeSwitch */
                        seniorModeSwitch?: (bilibili.community.service.dm.v1.IPlayerDanmakuSeniorModeSwitch|null);

                        /** DmPlayerConfigReq aiRecommendedLevelV2 */
                        aiRecommendedLevelV2?: (bilibili.community.service.dm.v1.IPlayerDanmakuAiRecommendedLevelV2|null);
                    }

                    /** Represents a DmPlayerConfigReq. */
                    class DmPlayerConfigReq implements IDmPlayerConfigReq {

                        /**
                         * Constructs a new DmPlayerConfigReq.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.IDmPlayerConfigReq);

                        /** DmPlayerConfigReq ts. */
                        public ts: (number|Long);

                        /** DmPlayerConfigReq switch. */
                        public switch?: (bilibili.community.service.dm.v1.IPlayerDanmakuSwitch|null);

                        /** DmPlayerConfigReq switchSave. */
                        public switchSave?: (bilibili.community.service.dm.v1.IPlayerDanmakuSwitchSave|null);

                        /** DmPlayerConfigReq useDefaultConfig. */
                        public useDefaultConfig?: (bilibili.community.service.dm.v1.IPlayerDanmakuUseDefaultConfig|null);

                        /** DmPlayerConfigReq aiRecommendedSwitch. */
                        public aiRecommendedSwitch?: (bilibili.community.service.dm.v1.IPlayerDanmakuAiRecommendedSwitch|null);

                        /** DmPlayerConfigReq aiRecommendedLevel. */
                        public aiRecommendedLevel?: (bilibili.community.service.dm.v1.IPlayerDanmakuAiRecommendedLevel|null);

                        /** DmPlayerConfigReq blocktop. */
                        public blocktop?: (bilibili.community.service.dm.v1.IPlayerDanmakuBlocktop|null);

                        /** DmPlayerConfigReq blockscroll. */
                        public blockscroll?: (bilibili.community.service.dm.v1.IPlayerDanmakuBlockscroll|null);

                        /** DmPlayerConfigReq blockbottom. */
                        public blockbottom?: (bilibili.community.service.dm.v1.IPlayerDanmakuBlockbottom|null);

                        /** DmPlayerConfigReq blockcolorful. */
                        public blockcolorful?: (bilibili.community.service.dm.v1.IPlayerDanmakuBlockcolorful|null);

                        /** DmPlayerConfigReq blockrepeat. */
                        public blockrepeat?: (bilibili.community.service.dm.v1.IPlayerDanmakuBlockrepeat|null);

                        /** DmPlayerConfigReq blockspecial. */
                        public blockspecial?: (bilibili.community.service.dm.v1.IPlayerDanmakuBlockspecial|null);

                        /** DmPlayerConfigReq opacity. */
                        public opacity?: (bilibili.community.service.dm.v1.IPlayerDanmakuOpacity|null);

                        /** DmPlayerConfigReq scalingfactor. */
                        public scalingfactor?: (bilibili.community.service.dm.v1.IPlayerDanmakuScalingfactor|null);

                        /** DmPlayerConfigReq domain. */
                        public domain?: (bilibili.community.service.dm.v1.IPlayerDanmakuDomain|null);

                        /** DmPlayerConfigReq speed. */
                        public speed?: (bilibili.community.service.dm.v1.IPlayerDanmakuSpeed|null);

                        /** DmPlayerConfigReq enableblocklist. */
                        public enableblocklist?: (bilibili.community.service.dm.v1.IPlayerDanmakuEnableblocklist|null);

                        /** DmPlayerConfigReq inlinePlayerDanmakuSwitch. */
                        public inlinePlayerDanmakuSwitch?: (bilibili.community.service.dm.v1.IInlinePlayerDanmakuSwitch|null);

                        /** DmPlayerConfigReq seniorModeSwitch. */
                        public seniorModeSwitch?: (bilibili.community.service.dm.v1.IPlayerDanmakuSeniorModeSwitch|null);

                        /** DmPlayerConfigReq aiRecommendedLevelV2. */
                        public aiRecommendedLevelV2?: (bilibili.community.service.dm.v1.IPlayerDanmakuAiRecommendedLevelV2|null);

                        /**
                         * Creates a new DmPlayerConfigReq instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns DmPlayerConfigReq instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.IDmPlayerConfigReq): bilibili.community.service.dm.v1.DmPlayerConfigReq;

                        /**
                         * Encodes the specified DmPlayerConfigReq message. Does not implicitly {@link bilibili.community.service.dm.v1.DmPlayerConfigReq.verify|verify} messages.
                         * @param message DmPlayerConfigReq message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.IDmPlayerConfigReq, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified DmPlayerConfigReq message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.DmPlayerConfigReq.verify|verify} messages.
                         * @param message DmPlayerConfigReq message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.IDmPlayerConfigReq, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a DmPlayerConfigReq message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns DmPlayerConfigReq
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.DmPlayerConfigReq;

                        /**
                         * Decodes a DmPlayerConfigReq message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns DmPlayerConfigReq
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.DmPlayerConfigReq;

                        /**
                         * Verifies a DmPlayerConfigReq message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a DmPlayerConfigReq message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns DmPlayerConfigReq
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.DmPlayerConfigReq;

                        /**
                         * Creates a plain object from a DmPlayerConfigReq message. Also converts values to other types if specified.
                         * @param message DmPlayerConfigReq
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.DmPlayerConfigReq, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this DmPlayerConfigReq to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for DmPlayerConfigReq
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** Properties of a DmSegConfig. */
                    interface IDmSegConfig {

                        /** DmSegConfig pageSize */
                        pageSize?: (number|Long|null);

                        /** DmSegConfig total */
                        total?: (number|Long|null);
                    }

                    /** Represents a DmSegConfig. */
                    class DmSegConfig implements IDmSegConfig {

                        /**
                         * Constructs a new DmSegConfig.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.IDmSegConfig);

                        /** DmSegConfig pageSize. */
                        public pageSize: (number|Long);

                        /** DmSegConfig total. */
                        public total: (number|Long);

                        /**
                         * Creates a new DmSegConfig instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns DmSegConfig instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.IDmSegConfig): bilibili.community.service.dm.v1.DmSegConfig;

                        /**
                         * Encodes the specified DmSegConfig message. Does not implicitly {@link bilibili.community.service.dm.v1.DmSegConfig.verify|verify} messages.
                         * @param message DmSegConfig message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.IDmSegConfig, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified DmSegConfig message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.DmSegConfig.verify|verify} messages.
                         * @param message DmSegConfig message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.IDmSegConfig, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a DmSegConfig message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns DmSegConfig
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.DmSegConfig;

                        /**
                         * Decodes a DmSegConfig message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns DmSegConfig
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.DmSegConfig;

                        /**
                         * Verifies a DmSegConfig message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a DmSegConfig message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns DmSegConfig
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.DmSegConfig;

                        /**
                         * Creates a plain object from a DmSegConfig message. Also converts values to other types if specified.
                         * @param message DmSegConfig
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.DmSegConfig, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this DmSegConfig to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for DmSegConfig
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** Properties of a DmSegMobileReply. */
                    interface IDmSegMobileReply {

                        /** DmSegMobileReply elems */
                        elems?: (bilibili.community.service.dm.v1.IDanmakuElem[]|null);

                        /** DmSegMobileReply state */
                        state?: (number|null);

                        /** DmSegMobileReply aiFlag */
                        aiFlag?: (bilibili.community.service.dm.v1.IDanmakuAIFlag|null);

                        /** DmSegMobileReply colorfulSrc */
                        colorfulSrc?: (bilibili.community.service.dm.v1.IDmColorful[]|null);
                    }

                    /** Represents a DmSegMobileReply. */
                    class DmSegMobileReply implements IDmSegMobileReply {

                        /**
                         * Constructs a new DmSegMobileReply.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.IDmSegMobileReply);

                        /** DmSegMobileReply elems. */
                        public elems: bilibili.community.service.dm.v1.IDanmakuElem[];

                        /** DmSegMobileReply state. */
                        public state: number;

                        /** DmSegMobileReply aiFlag. */
                        public aiFlag?: (bilibili.community.service.dm.v1.IDanmakuAIFlag|null);

                        /** DmSegMobileReply colorfulSrc. */
                        public colorfulSrc: bilibili.community.service.dm.v1.IDmColorful[];

                        /**
                         * Creates a new DmSegMobileReply instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns DmSegMobileReply instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.IDmSegMobileReply): bilibili.community.service.dm.v1.DmSegMobileReply;

                        /**
                         * Encodes the specified DmSegMobileReply message. Does not implicitly {@link bilibili.community.service.dm.v1.DmSegMobileReply.verify|verify} messages.
                         * @param message DmSegMobileReply message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.IDmSegMobileReply, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified DmSegMobileReply message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.DmSegMobileReply.verify|verify} messages.
                         * @param message DmSegMobileReply message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.IDmSegMobileReply, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a DmSegMobileReply message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns DmSegMobileReply
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.DmSegMobileReply;

                        /**
                         * Decodes a DmSegMobileReply message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns DmSegMobileReply
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.DmSegMobileReply;

                        /**
                         * Verifies a DmSegMobileReply message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a DmSegMobileReply message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns DmSegMobileReply
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.DmSegMobileReply;

                        /**
                         * Creates a plain object from a DmSegMobileReply message. Also converts values to other types if specified.
                         * @param message DmSegMobileReply
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.DmSegMobileReply, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this DmSegMobileReply to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for DmSegMobileReply
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** Properties of a DmSegMobileReq. */
                    interface IDmSegMobileReq {

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
                    }

                    /** Represents a DmSegMobileReq. */
                    class DmSegMobileReq implements IDmSegMobileReq {

                        /**
                         * Constructs a new DmSegMobileReq.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.IDmSegMobileReq);

                        /** DmSegMobileReq pid. */
                        public pid: (number|Long);

                        /** DmSegMobileReq oid. */
                        public oid: (number|Long);

                        /** DmSegMobileReq type. */
                        public type: number;

                        /** DmSegMobileReq segmentIndex. */
                        public segmentIndex: (number|Long);

                        /** DmSegMobileReq teenagersMode. */
                        public teenagersMode: number;

                        /** DmSegMobileReq ps. */
                        public ps: (number|Long);

                        /** DmSegMobileReq pe. */
                        public pe: (number|Long);

                        /** DmSegMobileReq pullMode. */
                        public pullMode: number;

                        /** DmSegMobileReq fromScene. */
                        public fromScene: number;

                        /**
                         * Creates a new DmSegMobileReq instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns DmSegMobileReq instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.IDmSegMobileReq): bilibili.community.service.dm.v1.DmSegMobileReq;

                        /**
                         * Encodes the specified DmSegMobileReq message. Does not implicitly {@link bilibili.community.service.dm.v1.DmSegMobileReq.verify|verify} messages.
                         * @param message DmSegMobileReq message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.IDmSegMobileReq, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified DmSegMobileReq message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.DmSegMobileReq.verify|verify} messages.
                         * @param message DmSegMobileReq message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.IDmSegMobileReq, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a DmSegMobileReq message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns DmSegMobileReq
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.DmSegMobileReq;

                        /**
                         * Decodes a DmSegMobileReq message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns DmSegMobileReq
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.DmSegMobileReq;

                        /**
                         * Verifies a DmSegMobileReq message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a DmSegMobileReq message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns DmSegMobileReq
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.DmSegMobileReq;

                        /**
                         * Creates a plain object from a DmSegMobileReq message. Also converts values to other types if specified.
                         * @param message DmSegMobileReq
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.DmSegMobileReq, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this DmSegMobileReq to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for DmSegMobileReq
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** Properties of a DmSegOttReply. */
                    interface IDmSegOttReply {

                        /** DmSegOttReply closed */
                        closed?: (boolean|null);

                        /** DmSegOttReply elems */
                        elems?: (bilibili.community.service.dm.v1.IDanmakuElem[]|null);
                    }

                    /** Represents a DmSegOttReply. */
                    class DmSegOttReply implements IDmSegOttReply {

                        /**
                         * Constructs a new DmSegOttReply.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.IDmSegOttReply);

                        /** DmSegOttReply closed. */
                        public closed: boolean;

                        /** DmSegOttReply elems. */
                        public elems: bilibili.community.service.dm.v1.IDanmakuElem[];

                        /**
                         * Creates a new DmSegOttReply instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns DmSegOttReply instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.IDmSegOttReply): bilibili.community.service.dm.v1.DmSegOttReply;

                        /**
                         * Encodes the specified DmSegOttReply message. Does not implicitly {@link bilibili.community.service.dm.v1.DmSegOttReply.verify|verify} messages.
                         * @param message DmSegOttReply message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.IDmSegOttReply, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified DmSegOttReply message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.DmSegOttReply.verify|verify} messages.
                         * @param message DmSegOttReply message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.IDmSegOttReply, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a DmSegOttReply message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns DmSegOttReply
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.DmSegOttReply;

                        /**
                         * Decodes a DmSegOttReply message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns DmSegOttReply
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.DmSegOttReply;

                        /**
                         * Verifies a DmSegOttReply message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a DmSegOttReply message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns DmSegOttReply
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.DmSegOttReply;

                        /**
                         * Creates a plain object from a DmSegOttReply message. Also converts values to other types if specified.
                         * @param message DmSegOttReply
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.DmSegOttReply, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this DmSegOttReply to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for DmSegOttReply
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** Properties of a DmSegOttReq. */
                    interface IDmSegOttReq {

                        /** DmSegOttReq pid */
                        pid?: (number|Long|null);

                        /** DmSegOttReq oid */
                        oid?: (number|Long|null);

                        /** DmSegOttReq type */
                        type?: (number|null);

                        /** DmSegOttReq segmentIndex */
                        segmentIndex?: (number|Long|null);
                    }

                    /** Represents a DmSegOttReq. */
                    class DmSegOttReq implements IDmSegOttReq {

                        /**
                         * Constructs a new DmSegOttReq.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.IDmSegOttReq);

                        /** DmSegOttReq pid. */
                        public pid: (number|Long);

                        /** DmSegOttReq oid. */
                        public oid: (number|Long);

                        /** DmSegOttReq type. */
                        public type: number;

                        /** DmSegOttReq segmentIndex. */
                        public segmentIndex: (number|Long);

                        /**
                         * Creates a new DmSegOttReq instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns DmSegOttReq instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.IDmSegOttReq): bilibili.community.service.dm.v1.DmSegOttReq;

                        /**
                         * Encodes the specified DmSegOttReq message. Does not implicitly {@link bilibili.community.service.dm.v1.DmSegOttReq.verify|verify} messages.
                         * @param message DmSegOttReq message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.IDmSegOttReq, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified DmSegOttReq message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.DmSegOttReq.verify|verify} messages.
                         * @param message DmSegOttReq message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.IDmSegOttReq, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a DmSegOttReq message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns DmSegOttReq
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.DmSegOttReq;

                        /**
                         * Decodes a DmSegOttReq message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns DmSegOttReq
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.DmSegOttReq;

                        /**
                         * Verifies a DmSegOttReq message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a DmSegOttReq message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns DmSegOttReq
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.DmSegOttReq;

                        /**
                         * Creates a plain object from a DmSegOttReq message. Also converts values to other types if specified.
                         * @param message DmSegOttReq
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.DmSegOttReq, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this DmSegOttReq to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for DmSegOttReq
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** Properties of a DmSegSDKReply. */
                    interface IDmSegSDKReply {

                        /** DmSegSDKReply closed */
                        closed?: (boolean|null);

                        /** DmSegSDKReply elems */
                        elems?: (bilibili.community.service.dm.v1.IDanmakuElem[]|null);
                    }

                    /** Represents a DmSegSDKReply. */
                    class DmSegSDKReply implements IDmSegSDKReply {

                        /**
                         * Constructs a new DmSegSDKReply.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.IDmSegSDKReply);

                        /** DmSegSDKReply closed. */
                        public closed: boolean;

                        /** DmSegSDKReply elems. */
                        public elems: bilibili.community.service.dm.v1.IDanmakuElem[];

                        /**
                         * Creates a new DmSegSDKReply instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns DmSegSDKReply instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.IDmSegSDKReply): bilibili.community.service.dm.v1.DmSegSDKReply;

                        /**
                         * Encodes the specified DmSegSDKReply message. Does not implicitly {@link bilibili.community.service.dm.v1.DmSegSDKReply.verify|verify} messages.
                         * @param message DmSegSDKReply message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.IDmSegSDKReply, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified DmSegSDKReply message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.DmSegSDKReply.verify|verify} messages.
                         * @param message DmSegSDKReply message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.IDmSegSDKReply, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a DmSegSDKReply message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns DmSegSDKReply
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.DmSegSDKReply;

                        /**
                         * Decodes a DmSegSDKReply message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns DmSegSDKReply
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.DmSegSDKReply;

                        /**
                         * Verifies a DmSegSDKReply message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a DmSegSDKReply message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns DmSegSDKReply
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.DmSegSDKReply;

                        /**
                         * Creates a plain object from a DmSegSDKReply message. Also converts values to other types if specified.
                         * @param message DmSegSDKReply
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.DmSegSDKReply, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this DmSegSDKReply to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for DmSegSDKReply
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** Properties of a DmSegSDKReq. */
                    interface IDmSegSDKReq {

                        /** DmSegSDKReq pid */
                        pid?: (number|Long|null);

                        /** DmSegSDKReq oid */
                        oid?: (number|Long|null);

                        /** DmSegSDKReq type */
                        type?: (number|null);

                        /** DmSegSDKReq segmentIndex */
                        segmentIndex?: (number|Long|null);
                    }

                    /** Represents a DmSegSDKReq. */
                    class DmSegSDKReq implements IDmSegSDKReq {

                        /**
                         * Constructs a new DmSegSDKReq.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.IDmSegSDKReq);

                        /** DmSegSDKReq pid. */
                        public pid: (number|Long);

                        /** DmSegSDKReq oid. */
                        public oid: (number|Long);

                        /** DmSegSDKReq type. */
                        public type: number;

                        /** DmSegSDKReq segmentIndex. */
                        public segmentIndex: (number|Long);

                        /**
                         * Creates a new DmSegSDKReq instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns DmSegSDKReq instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.IDmSegSDKReq): bilibili.community.service.dm.v1.DmSegSDKReq;

                        /**
                         * Encodes the specified DmSegSDKReq message. Does not implicitly {@link bilibili.community.service.dm.v1.DmSegSDKReq.verify|verify} messages.
                         * @param message DmSegSDKReq message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.IDmSegSDKReq, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified DmSegSDKReq message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.DmSegSDKReq.verify|verify} messages.
                         * @param message DmSegSDKReq message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.IDmSegSDKReq, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a DmSegSDKReq message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns DmSegSDKReq
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.DmSegSDKReq;

                        /**
                         * Decodes a DmSegSDKReq message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns DmSegSDKReq
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.DmSegSDKReq;

                        /**
                         * Verifies a DmSegSDKReq message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a DmSegSDKReq message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns DmSegSDKReq
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.DmSegSDKReq;

                        /**
                         * Creates a plain object from a DmSegSDKReq message. Also converts values to other types if specified.
                         * @param message DmSegSDKReq
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.DmSegSDKReq, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this DmSegSDKReq to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for DmSegSDKReq
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** Properties of a DmViewReply. */
                    interface IDmViewReply {

                        /** DmViewReply closed */
                        closed?: (boolean|null);

                        /** DmViewReply mask */
                        mask?: (bilibili.community.service.dm.v1.IVideoMask|null);

                        /** DmViewReply subtitle */
                        subtitle?: (bilibili.community.service.dm.v1.IVideoSubtitle|null);

                        /** DmViewReply specialDms */
                        specialDms?: (string[]|null);

                        /** DmViewReply aiFlag */
                        aiFlag?: (bilibili.community.service.dm.v1.IDanmakuFlagConfig|null);

                        /** DmViewReply playerConfig */
                        playerConfig?: (bilibili.community.service.dm.v1.IDanmuPlayerViewConfig|null);

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
                        expoReport?: (bilibili.community.service.dm.v1.IExpoReport|null);

                        /** DmViewReply buzzwordConfig */
                        buzzwordConfig?: (bilibili.community.service.dm.v1.IBuzzwordConfig|null);

                        /** DmViewReply expressions */
                        expressions?: (bilibili.community.service.dm.v1.IExpressions[]|null);

                        /** DmViewReply postPanel */
                        postPanel?: (bilibili.community.service.dm.v1.IPostPanel[]|null);

                        /** DmViewReply activityMeta */
                        activityMeta?: (string[]|null);

                        /** DmViewReply postPanel2 */
                        postPanel2?: (bilibili.community.service.dm.v1.IPostPanelV2[]|null);
                    }

                    /** Represents a DmViewReply. */
                    class DmViewReply implements IDmViewReply {

                        /**
                         * Constructs a new DmViewReply.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.IDmViewReply);

                        /** DmViewReply closed. */
                        public closed: boolean;

                        /** DmViewReply mask. */
                        public mask?: (bilibili.community.service.dm.v1.IVideoMask|null);

                        /** DmViewReply subtitle. */
                        public subtitle?: (bilibili.community.service.dm.v1.IVideoSubtitle|null);

                        /** DmViewReply specialDms. */
                        public specialDms: string[];

                        /** DmViewReply aiFlag. */
                        public aiFlag?: (bilibili.community.service.dm.v1.IDanmakuFlagConfig|null);

                        /** DmViewReply playerConfig. */
                        public playerConfig?: (bilibili.community.service.dm.v1.IDanmuPlayerViewConfig|null);

                        /** DmViewReply sendBoxStyle. */
                        public sendBoxStyle: number;

                        /** DmViewReply allow. */
                        public allow: boolean;

                        /** DmViewReply checkBox. */
                        public checkBox: string;

                        /** DmViewReply checkBoxShowMsg. */
                        public checkBoxShowMsg: string;

                        /** DmViewReply textPlaceholder. */
                        public textPlaceholder: string;

                        /** DmViewReply inputPlaceholder. */
                        public inputPlaceholder: string;

                        /** DmViewReply reportFilterContent. */
                        public reportFilterContent: string[];

                        /** DmViewReply expoReport. */
                        public expoReport?: (bilibili.community.service.dm.v1.IExpoReport|null);

                        /** DmViewReply buzzwordConfig. */
                        public buzzwordConfig?: (bilibili.community.service.dm.v1.IBuzzwordConfig|null);

                        /** DmViewReply expressions. */
                        public expressions: bilibili.community.service.dm.v1.IExpressions[];

                        /** DmViewReply postPanel. */
                        public postPanel: bilibili.community.service.dm.v1.IPostPanel[];

                        /** DmViewReply activityMeta. */
                        public activityMeta: string[];

                        /** DmViewReply postPanel2. */
                        public postPanel2: bilibili.community.service.dm.v1.IPostPanelV2[];

                        /**
                         * Creates a new DmViewReply instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns DmViewReply instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.IDmViewReply): bilibili.community.service.dm.v1.DmViewReply;

                        /**
                         * Encodes the specified DmViewReply message. Does not implicitly {@link bilibili.community.service.dm.v1.DmViewReply.verify|verify} messages.
                         * @param message DmViewReply message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.IDmViewReply, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified DmViewReply message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.DmViewReply.verify|verify} messages.
                         * @param message DmViewReply message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.IDmViewReply, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a DmViewReply message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns DmViewReply
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.DmViewReply;

                        /**
                         * Decodes a DmViewReply message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns DmViewReply
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.DmViewReply;

                        /**
                         * Verifies a DmViewReply message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a DmViewReply message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns DmViewReply
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.DmViewReply;

                        /**
                         * Creates a plain object from a DmViewReply message. Also converts values to other types if specified.
                         * @param message DmViewReply
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.DmViewReply, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this DmViewReply to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for DmViewReply
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** Properties of a DmViewReq. */
                    interface IDmViewReq {

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
                    }

                    /** Represents a DmViewReq. */
                    class DmViewReq implements IDmViewReq {

                        /**
                         * Constructs a new DmViewReq.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.IDmViewReq);

                        /** DmViewReq pid. */
                        public pid: (number|Long);

                        /** DmViewReq oid. */
                        public oid: (number|Long);

                        /** DmViewReq type. */
                        public type: number;

                        /** DmViewReq spmid. */
                        public spmid: string;

                        /** DmViewReq isHardBoot. */
                        public isHardBoot: number;

                        /**
                         * Creates a new DmViewReq instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns DmViewReq instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.IDmViewReq): bilibili.community.service.dm.v1.DmViewReq;

                        /**
                         * Encodes the specified DmViewReq message. Does not implicitly {@link bilibili.community.service.dm.v1.DmViewReq.verify|verify} messages.
                         * @param message DmViewReq message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.IDmViewReq, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified DmViewReq message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.DmViewReq.verify|verify} messages.
                         * @param message DmViewReq message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.IDmViewReq, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a DmViewReq message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns DmViewReq
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.DmViewReq;

                        /**
                         * Decodes a DmViewReq message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns DmViewReq
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.DmViewReq;

                        /**
                         * Verifies a DmViewReq message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a DmViewReq message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns DmViewReq
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.DmViewReq;

                        /**
                         * Creates a plain object from a DmViewReq message. Also converts values to other types if specified.
                         * @param message DmViewReq
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.DmViewReq, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this DmViewReq to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for DmViewReq
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** Properties of a DmWebViewReply. */
                    interface IDmWebViewReply {

                        /** DmWebViewReply state */
                        state?: (number|null);

                        /** DmWebViewReply text */
                        text?: (string|null);

                        /** DmWebViewReply textSide */
                        textSide?: (string|null);

                        /** DmWebViewReply dmSge */
                        dmSge?: (bilibili.community.service.dm.v1.IDmSegConfig|null);

                        /** DmWebViewReply flag */
                        flag?: (bilibili.community.service.dm.v1.IDanmakuFlagConfig|null);

                        /** DmWebViewReply specialDms */
                        specialDms?: (string[]|null);

                        /** DmWebViewReply checkBox */
                        checkBox?: (boolean|null);

                        /** DmWebViewReply count */
                        count?: (number|Long|null);

                        /** DmWebViewReply commandDms */
                        commandDms?: (bilibili.community.service.dm.v1.ICommandDm[]|null);

                        /** DmWebViewReply playerConfig */
                        playerConfig?: (bilibili.community.service.dm.v1.IDanmuWebPlayerConfig|null);

                        /** DmWebViewReply reportFilterContent */
                        reportFilterContent?: (string[]|null);

                        /** DmWebViewReply expressions */
                        expressions?: (bilibili.community.service.dm.v1.IExpressions[]|null);

                        /** DmWebViewReply postPanel */
                        postPanel?: (bilibili.community.service.dm.v1.IPostPanel[]|null);

                        /** DmWebViewReply activityMeta */
                        activityMeta?: (string[]|null);
                    }

                    /** Represents a DmWebViewReply. */
                    class DmWebViewReply implements IDmWebViewReply {

                        /**
                         * Constructs a new DmWebViewReply.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.IDmWebViewReply);

                        /** DmWebViewReply state. */
                        public state: number;

                        /** DmWebViewReply text. */
                        public text: string;

                        /** DmWebViewReply textSide. */
                        public textSide: string;

                        /** DmWebViewReply dmSge. */
                        public dmSge?: (bilibili.community.service.dm.v1.IDmSegConfig|null);

                        /** DmWebViewReply flag. */
                        public flag?: (bilibili.community.service.dm.v1.IDanmakuFlagConfig|null);

                        /** DmWebViewReply specialDms. */
                        public specialDms: string[];

                        /** DmWebViewReply checkBox. */
                        public checkBox: boolean;

                        /** DmWebViewReply count. */
                        public count: (number|Long);

                        /** DmWebViewReply commandDms. */
                        public commandDms: bilibili.community.service.dm.v1.ICommandDm[];

                        /** DmWebViewReply playerConfig. */
                        public playerConfig?: (bilibili.community.service.dm.v1.IDanmuWebPlayerConfig|null);

                        /** DmWebViewReply reportFilterContent. */
                        public reportFilterContent: string[];

                        /** DmWebViewReply expressions. */
                        public expressions: bilibili.community.service.dm.v1.IExpressions[];

                        /** DmWebViewReply postPanel. */
                        public postPanel: bilibili.community.service.dm.v1.IPostPanel[];

                        /** DmWebViewReply activityMeta. */
                        public activityMeta: string[];

                        /**
                         * Creates a new DmWebViewReply instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns DmWebViewReply instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.IDmWebViewReply): bilibili.community.service.dm.v1.DmWebViewReply;

                        /**
                         * Encodes the specified DmWebViewReply message. Does not implicitly {@link bilibili.community.service.dm.v1.DmWebViewReply.verify|verify} messages.
                         * @param message DmWebViewReply message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.IDmWebViewReply, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified DmWebViewReply message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.DmWebViewReply.verify|verify} messages.
                         * @param message DmWebViewReply message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.IDmWebViewReply, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a DmWebViewReply message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns DmWebViewReply
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.DmWebViewReply;

                        /**
                         * Decodes a DmWebViewReply message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns DmWebViewReply
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.DmWebViewReply;

                        /**
                         * Verifies a DmWebViewReply message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a DmWebViewReply message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns DmWebViewReply
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.DmWebViewReply;

                        /**
                         * Creates a plain object from a DmWebViewReply message. Also converts values to other types if specified.
                         * @param message DmWebViewReply
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.DmWebViewReply, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this DmWebViewReply to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for DmWebViewReply
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** Properties of an ExpoReport. */
                    interface IExpoReport {

                        /** ExpoReport shouldReportAtEnd */
                        shouldReportAtEnd?: (boolean|null);
                    }

                    /** Represents an ExpoReport. */
                    class ExpoReport implements IExpoReport {

                        /**
                         * Constructs a new ExpoReport.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.IExpoReport);

                        /** ExpoReport shouldReportAtEnd. */
                        public shouldReportAtEnd: boolean;

                        /**
                         * Creates a new ExpoReport instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns ExpoReport instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.IExpoReport): bilibili.community.service.dm.v1.ExpoReport;

                        /**
                         * Encodes the specified ExpoReport message. Does not implicitly {@link bilibili.community.service.dm.v1.ExpoReport.verify|verify} messages.
                         * @param message ExpoReport message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.IExpoReport, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified ExpoReport message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.ExpoReport.verify|verify} messages.
                         * @param message ExpoReport message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.IExpoReport, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes an ExpoReport message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns ExpoReport
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.ExpoReport;

                        /**
                         * Decodes an ExpoReport message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns ExpoReport
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.ExpoReport;

                        /**
                         * Verifies an ExpoReport message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates an ExpoReport message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns ExpoReport
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.ExpoReport;

                        /**
                         * Creates a plain object from an ExpoReport message. Also converts values to other types if specified.
                         * @param message ExpoReport
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.ExpoReport, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this ExpoReport to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for ExpoReport
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** ExposureType enum. */
                    enum ExposureType {
                        ExposureTypeNone = 0,
                        ExposureTypeDMSend = 1
                    }

                    /** Properties of an Expression. */
                    interface IExpression {

                        /** Expression keyword */
                        keyword?: (string[]|null);

                        /** Expression url */
                        url?: (string|null);

                        /** Expression period */
                        period?: (bilibili.community.service.dm.v1.IPeriod[]|null);
                    }

                    /** Represents an Expression. */
                    class Expression implements IExpression {

                        /**
                         * Constructs a new Expression.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.IExpression);

                        /** Expression keyword. */
                        public keyword: string[];

                        /** Expression url. */
                        public url: string;

                        /** Expression period. */
                        public period: bilibili.community.service.dm.v1.IPeriod[];

                        /**
                         * Creates a new Expression instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns Expression instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.IExpression): bilibili.community.service.dm.v1.Expression;

                        /**
                         * Encodes the specified Expression message. Does not implicitly {@link bilibili.community.service.dm.v1.Expression.verify|verify} messages.
                         * @param message Expression message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.IExpression, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified Expression message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.Expression.verify|verify} messages.
                         * @param message Expression message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.IExpression, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes an Expression message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns Expression
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.Expression;

                        /**
                         * Decodes an Expression message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns Expression
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.Expression;

                        /**
                         * Verifies an Expression message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates an Expression message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns Expression
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.Expression;

                        /**
                         * Creates a plain object from an Expression message. Also converts values to other types if specified.
                         * @param message Expression
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.Expression, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this Expression to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for Expression
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** Properties of an Expressions. */
                    interface IExpressions {

                        /** Expressions data */
                        data?: (bilibili.community.service.dm.v1.IExpression[]|null);
                    }

                    /** Represents an Expressions. */
                    class Expressions implements IExpressions {

                        /**
                         * Constructs a new Expressions.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.IExpressions);

                        /** Expressions data. */
                        public data: bilibili.community.service.dm.v1.IExpression[];

                        /**
                         * Creates a new Expressions instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns Expressions instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.IExpressions): bilibili.community.service.dm.v1.Expressions;

                        /**
                         * Encodes the specified Expressions message. Does not implicitly {@link bilibili.community.service.dm.v1.Expressions.verify|verify} messages.
                         * @param message Expressions message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.IExpressions, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified Expressions message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.Expressions.verify|verify} messages.
                         * @param message Expressions message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.IExpressions, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes an Expressions message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns Expressions
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.Expressions;

                        /**
                         * Decodes an Expressions message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns Expressions
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.Expressions;

                        /**
                         * Verifies an Expressions message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates an Expressions message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns Expressions
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.Expressions;

                        /**
                         * Creates a plain object from an Expressions message. Also converts values to other types if specified.
                         * @param message Expressions
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.Expressions, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this Expressions to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for Expressions
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** Properties of an InlinePlayerDanmakuSwitch. */
                    interface IInlinePlayerDanmakuSwitch {

                        /** InlinePlayerDanmakuSwitch value */
                        value?: (boolean|null);
                    }

                    /** Represents an InlinePlayerDanmakuSwitch. */
                    class InlinePlayerDanmakuSwitch implements IInlinePlayerDanmakuSwitch {

                        /**
                         * Constructs a new InlinePlayerDanmakuSwitch.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.IInlinePlayerDanmakuSwitch);

                        /** InlinePlayerDanmakuSwitch value. */
                        public value: boolean;

                        /**
                         * Creates a new InlinePlayerDanmakuSwitch instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns InlinePlayerDanmakuSwitch instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.IInlinePlayerDanmakuSwitch): bilibili.community.service.dm.v1.InlinePlayerDanmakuSwitch;

                        /**
                         * Encodes the specified InlinePlayerDanmakuSwitch message. Does not implicitly {@link bilibili.community.service.dm.v1.InlinePlayerDanmakuSwitch.verify|verify} messages.
                         * @param message InlinePlayerDanmakuSwitch message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.IInlinePlayerDanmakuSwitch, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified InlinePlayerDanmakuSwitch message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.InlinePlayerDanmakuSwitch.verify|verify} messages.
                         * @param message InlinePlayerDanmakuSwitch message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.IInlinePlayerDanmakuSwitch, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes an InlinePlayerDanmakuSwitch message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns InlinePlayerDanmakuSwitch
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.InlinePlayerDanmakuSwitch;

                        /**
                         * Decodes an InlinePlayerDanmakuSwitch message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns InlinePlayerDanmakuSwitch
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.InlinePlayerDanmakuSwitch;

                        /**
                         * Verifies an InlinePlayerDanmakuSwitch message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates an InlinePlayerDanmakuSwitch message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns InlinePlayerDanmakuSwitch
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.InlinePlayerDanmakuSwitch;

                        /**
                         * Creates a plain object from an InlinePlayerDanmakuSwitch message. Also converts values to other types if specified.
                         * @param message InlinePlayerDanmakuSwitch
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.InlinePlayerDanmakuSwitch, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this InlinePlayerDanmakuSwitch to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for InlinePlayerDanmakuSwitch
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** Properties of a Label. */
                    interface ILabel {

                        /** Label title */
                        title?: (string|null);

                        /** Label content */
                        content?: (string[]|null);
                    }

                    /** Represents a Label. */
                    class Label implements ILabel {

                        /**
                         * Constructs a new Label.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.ILabel);

                        /** Label title. */
                        public title: string;

                        /** Label content. */
                        public content: string[];

                        /**
                         * Creates a new Label instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns Label instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.ILabel): bilibili.community.service.dm.v1.Label;

                        /**
                         * Encodes the specified Label message. Does not implicitly {@link bilibili.community.service.dm.v1.Label.verify|verify} messages.
                         * @param message Label message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.ILabel, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified Label message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.Label.verify|verify} messages.
                         * @param message Label message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.ILabel, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a Label message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns Label
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.Label;

                        /**
                         * Decodes a Label message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns Label
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.Label;

                        /**
                         * Verifies a Label message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a Label message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns Label
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.Label;

                        /**
                         * Creates a plain object from a Label message. Also converts values to other types if specified.
                         * @param message Label
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.Label, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this Label to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for Label
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** Properties of a LabelV2. */
                    interface ILabelV2 {

                        /** LabelV2 title */
                        title?: (string|null);

                        /** LabelV2 content */
                        content?: (string[]|null);

                        /** LabelV2 exposureOnce */
                        exposureOnce?: (boolean|null);

                        /** LabelV2 exposureType */
                        exposureType?: (number|null);
                    }

                    /** Represents a LabelV2. */
                    class LabelV2 implements ILabelV2 {

                        /**
                         * Constructs a new LabelV2.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.ILabelV2);

                        /** LabelV2 title. */
                        public title: string;

                        /** LabelV2 content. */
                        public content: string[];

                        /** LabelV2 exposureOnce. */
                        public exposureOnce: boolean;

                        /** LabelV2 exposureType. */
                        public exposureType: number;

                        /**
                         * Creates a new LabelV2 instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns LabelV2 instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.ILabelV2): bilibili.community.service.dm.v1.LabelV2;

                        /**
                         * Encodes the specified LabelV2 message. Does not implicitly {@link bilibili.community.service.dm.v1.LabelV2.verify|verify} messages.
                         * @param message LabelV2 message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.ILabelV2, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified LabelV2 message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.LabelV2.verify|verify} messages.
                         * @param message LabelV2 message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.ILabelV2, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a LabelV2 message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns LabelV2
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.LabelV2;

                        /**
                         * Decodes a LabelV2 message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns LabelV2
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.LabelV2;

                        /**
                         * Verifies a LabelV2 message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a LabelV2 message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns LabelV2
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.LabelV2;

                        /**
                         * Creates a plain object from a LabelV2 message. Also converts values to other types if specified.
                         * @param message LabelV2
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.LabelV2, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this LabelV2 to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for LabelV2
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** Properties of a Period. */
                    interface IPeriod {

                        /** Period start */
                        start?: (number|Long|null);

                        /** Period end */
                        end?: (number|Long|null);
                    }

                    /** Represents a Period. */
                    class Period implements IPeriod {

                        /**
                         * Constructs a new Period.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.IPeriod);

                        /** Period start. */
                        public start: (number|Long);

                        /** Period end. */
                        public end: (number|Long);

                        /**
                         * Creates a new Period instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns Period instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.IPeriod): bilibili.community.service.dm.v1.Period;

                        /**
                         * Encodes the specified Period message. Does not implicitly {@link bilibili.community.service.dm.v1.Period.verify|verify} messages.
                         * @param message Period message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.IPeriod, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified Period message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.Period.verify|verify} messages.
                         * @param message Period message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.IPeriod, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a Period message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns Period
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.Period;

                        /**
                         * Decodes a Period message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns Period
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.Period;

                        /**
                         * Verifies a Period message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a Period message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns Period
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.Period;

                        /**
                         * Creates a plain object from a Period message. Also converts values to other types if specified.
                         * @param message Period
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.Period, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this Period to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for Period
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** Properties of a PlayerDanmakuAiRecommendedLevel. */
                    interface IPlayerDanmakuAiRecommendedLevel {

                        /** PlayerDanmakuAiRecommendedLevel value */
                        value?: (boolean|null);
                    }

                    /** Represents a PlayerDanmakuAiRecommendedLevel. */
                    class PlayerDanmakuAiRecommendedLevel implements IPlayerDanmakuAiRecommendedLevel {

                        /**
                         * Constructs a new PlayerDanmakuAiRecommendedLevel.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.IPlayerDanmakuAiRecommendedLevel);

                        /** PlayerDanmakuAiRecommendedLevel value. */
                        public value: boolean;

                        /**
                         * Creates a new PlayerDanmakuAiRecommendedLevel instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns PlayerDanmakuAiRecommendedLevel instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.IPlayerDanmakuAiRecommendedLevel): bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedLevel;

                        /**
                         * Encodes the specified PlayerDanmakuAiRecommendedLevel message. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedLevel.verify|verify} messages.
                         * @param message PlayerDanmakuAiRecommendedLevel message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.IPlayerDanmakuAiRecommendedLevel, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified PlayerDanmakuAiRecommendedLevel message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedLevel.verify|verify} messages.
                         * @param message PlayerDanmakuAiRecommendedLevel message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.IPlayerDanmakuAiRecommendedLevel, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a PlayerDanmakuAiRecommendedLevel message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns PlayerDanmakuAiRecommendedLevel
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedLevel;

                        /**
                         * Decodes a PlayerDanmakuAiRecommendedLevel message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns PlayerDanmakuAiRecommendedLevel
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedLevel;

                        /**
                         * Verifies a PlayerDanmakuAiRecommendedLevel message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a PlayerDanmakuAiRecommendedLevel message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns PlayerDanmakuAiRecommendedLevel
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedLevel;

                        /**
                         * Creates a plain object from a PlayerDanmakuAiRecommendedLevel message. Also converts values to other types if specified.
                         * @param message PlayerDanmakuAiRecommendedLevel
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedLevel, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this PlayerDanmakuAiRecommendedLevel to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for PlayerDanmakuAiRecommendedLevel
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** Properties of a PlayerDanmakuAiRecommendedLevelV2. */
                    interface IPlayerDanmakuAiRecommendedLevelV2 {

                        /** PlayerDanmakuAiRecommendedLevelV2 value */
                        value?: (number|null);
                    }

                    /** Represents a PlayerDanmakuAiRecommendedLevelV2. */
                    class PlayerDanmakuAiRecommendedLevelV2 implements IPlayerDanmakuAiRecommendedLevelV2 {

                        /**
                         * Constructs a new PlayerDanmakuAiRecommendedLevelV2.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.IPlayerDanmakuAiRecommendedLevelV2);

                        /** PlayerDanmakuAiRecommendedLevelV2 value. */
                        public value: number;

                        /**
                         * Creates a new PlayerDanmakuAiRecommendedLevelV2 instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns PlayerDanmakuAiRecommendedLevelV2 instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.IPlayerDanmakuAiRecommendedLevelV2): bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedLevelV2;

                        /**
                         * Encodes the specified PlayerDanmakuAiRecommendedLevelV2 message. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedLevelV2.verify|verify} messages.
                         * @param message PlayerDanmakuAiRecommendedLevelV2 message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.IPlayerDanmakuAiRecommendedLevelV2, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified PlayerDanmakuAiRecommendedLevelV2 message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedLevelV2.verify|verify} messages.
                         * @param message PlayerDanmakuAiRecommendedLevelV2 message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.IPlayerDanmakuAiRecommendedLevelV2, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a PlayerDanmakuAiRecommendedLevelV2 message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns PlayerDanmakuAiRecommendedLevelV2
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedLevelV2;

                        /**
                         * Decodes a PlayerDanmakuAiRecommendedLevelV2 message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns PlayerDanmakuAiRecommendedLevelV2
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedLevelV2;

                        /**
                         * Verifies a PlayerDanmakuAiRecommendedLevelV2 message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a PlayerDanmakuAiRecommendedLevelV2 message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns PlayerDanmakuAiRecommendedLevelV2
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedLevelV2;

                        /**
                         * Creates a plain object from a PlayerDanmakuAiRecommendedLevelV2 message. Also converts values to other types if specified.
                         * @param message PlayerDanmakuAiRecommendedLevelV2
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedLevelV2, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this PlayerDanmakuAiRecommendedLevelV2 to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for PlayerDanmakuAiRecommendedLevelV2
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** Properties of a PlayerDanmakuAiRecommendedSwitch. */
                    interface IPlayerDanmakuAiRecommendedSwitch {

                        /** PlayerDanmakuAiRecommendedSwitch value */
                        value?: (boolean|null);
                    }

                    /** Represents a PlayerDanmakuAiRecommendedSwitch. */
                    class PlayerDanmakuAiRecommendedSwitch implements IPlayerDanmakuAiRecommendedSwitch {

                        /**
                         * Constructs a new PlayerDanmakuAiRecommendedSwitch.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.IPlayerDanmakuAiRecommendedSwitch);

                        /** PlayerDanmakuAiRecommendedSwitch value. */
                        public value: boolean;

                        /**
                         * Creates a new PlayerDanmakuAiRecommendedSwitch instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns PlayerDanmakuAiRecommendedSwitch instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.IPlayerDanmakuAiRecommendedSwitch): bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedSwitch;

                        /**
                         * Encodes the specified PlayerDanmakuAiRecommendedSwitch message. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedSwitch.verify|verify} messages.
                         * @param message PlayerDanmakuAiRecommendedSwitch message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.IPlayerDanmakuAiRecommendedSwitch, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified PlayerDanmakuAiRecommendedSwitch message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedSwitch.verify|verify} messages.
                         * @param message PlayerDanmakuAiRecommendedSwitch message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.IPlayerDanmakuAiRecommendedSwitch, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a PlayerDanmakuAiRecommendedSwitch message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns PlayerDanmakuAiRecommendedSwitch
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedSwitch;

                        /**
                         * Decodes a PlayerDanmakuAiRecommendedSwitch message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns PlayerDanmakuAiRecommendedSwitch
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedSwitch;

                        /**
                         * Verifies a PlayerDanmakuAiRecommendedSwitch message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a PlayerDanmakuAiRecommendedSwitch message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns PlayerDanmakuAiRecommendedSwitch
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedSwitch;

                        /**
                         * Creates a plain object from a PlayerDanmakuAiRecommendedSwitch message. Also converts values to other types if specified.
                         * @param message PlayerDanmakuAiRecommendedSwitch
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.PlayerDanmakuAiRecommendedSwitch, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this PlayerDanmakuAiRecommendedSwitch to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for PlayerDanmakuAiRecommendedSwitch
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** Properties of a PlayerDanmakuBlockbottom. */
                    interface IPlayerDanmakuBlockbottom {

                        /** PlayerDanmakuBlockbottom value */
                        value?: (boolean|null);
                    }

                    /** Represents a PlayerDanmakuBlockbottom. */
                    class PlayerDanmakuBlockbottom implements IPlayerDanmakuBlockbottom {

                        /**
                         * Constructs a new PlayerDanmakuBlockbottom.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.IPlayerDanmakuBlockbottom);

                        /** PlayerDanmakuBlockbottom value. */
                        public value: boolean;

                        /**
                         * Creates a new PlayerDanmakuBlockbottom instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns PlayerDanmakuBlockbottom instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.IPlayerDanmakuBlockbottom): bilibili.community.service.dm.v1.PlayerDanmakuBlockbottom;

                        /**
                         * Encodes the specified PlayerDanmakuBlockbottom message. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuBlockbottom.verify|verify} messages.
                         * @param message PlayerDanmakuBlockbottom message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.IPlayerDanmakuBlockbottom, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified PlayerDanmakuBlockbottom message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuBlockbottom.verify|verify} messages.
                         * @param message PlayerDanmakuBlockbottom message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.IPlayerDanmakuBlockbottom, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a PlayerDanmakuBlockbottom message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns PlayerDanmakuBlockbottom
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.PlayerDanmakuBlockbottom;

                        /**
                         * Decodes a PlayerDanmakuBlockbottom message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns PlayerDanmakuBlockbottom
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.PlayerDanmakuBlockbottom;

                        /**
                         * Verifies a PlayerDanmakuBlockbottom message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a PlayerDanmakuBlockbottom message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns PlayerDanmakuBlockbottom
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.PlayerDanmakuBlockbottom;

                        /**
                         * Creates a plain object from a PlayerDanmakuBlockbottom message. Also converts values to other types if specified.
                         * @param message PlayerDanmakuBlockbottom
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.PlayerDanmakuBlockbottom, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this PlayerDanmakuBlockbottom to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for PlayerDanmakuBlockbottom
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** Properties of a PlayerDanmakuBlockcolorful. */
                    interface IPlayerDanmakuBlockcolorful {

                        /** PlayerDanmakuBlockcolorful value */
                        value?: (boolean|null);
                    }

                    /** Represents a PlayerDanmakuBlockcolorful. */
                    class PlayerDanmakuBlockcolorful implements IPlayerDanmakuBlockcolorful {

                        /**
                         * Constructs a new PlayerDanmakuBlockcolorful.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.IPlayerDanmakuBlockcolorful);

                        /** PlayerDanmakuBlockcolorful value. */
                        public value: boolean;

                        /**
                         * Creates a new PlayerDanmakuBlockcolorful instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns PlayerDanmakuBlockcolorful instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.IPlayerDanmakuBlockcolorful): bilibili.community.service.dm.v1.PlayerDanmakuBlockcolorful;

                        /**
                         * Encodes the specified PlayerDanmakuBlockcolorful message. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuBlockcolorful.verify|verify} messages.
                         * @param message PlayerDanmakuBlockcolorful message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.IPlayerDanmakuBlockcolorful, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified PlayerDanmakuBlockcolorful message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuBlockcolorful.verify|verify} messages.
                         * @param message PlayerDanmakuBlockcolorful message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.IPlayerDanmakuBlockcolorful, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a PlayerDanmakuBlockcolorful message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns PlayerDanmakuBlockcolorful
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.PlayerDanmakuBlockcolorful;

                        /**
                         * Decodes a PlayerDanmakuBlockcolorful message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns PlayerDanmakuBlockcolorful
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.PlayerDanmakuBlockcolorful;

                        /**
                         * Verifies a PlayerDanmakuBlockcolorful message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a PlayerDanmakuBlockcolorful message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns PlayerDanmakuBlockcolorful
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.PlayerDanmakuBlockcolorful;

                        /**
                         * Creates a plain object from a PlayerDanmakuBlockcolorful message. Also converts values to other types if specified.
                         * @param message PlayerDanmakuBlockcolorful
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.PlayerDanmakuBlockcolorful, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this PlayerDanmakuBlockcolorful to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for PlayerDanmakuBlockcolorful
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** Properties of a PlayerDanmakuBlockrepeat. */
                    interface IPlayerDanmakuBlockrepeat {

                        /** PlayerDanmakuBlockrepeat value */
                        value?: (boolean|null);
                    }

                    /** Represents a PlayerDanmakuBlockrepeat. */
                    class PlayerDanmakuBlockrepeat implements IPlayerDanmakuBlockrepeat {

                        /**
                         * Constructs a new PlayerDanmakuBlockrepeat.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.IPlayerDanmakuBlockrepeat);

                        /** PlayerDanmakuBlockrepeat value. */
                        public value: boolean;

                        /**
                         * Creates a new PlayerDanmakuBlockrepeat instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns PlayerDanmakuBlockrepeat instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.IPlayerDanmakuBlockrepeat): bilibili.community.service.dm.v1.PlayerDanmakuBlockrepeat;

                        /**
                         * Encodes the specified PlayerDanmakuBlockrepeat message. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuBlockrepeat.verify|verify} messages.
                         * @param message PlayerDanmakuBlockrepeat message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.IPlayerDanmakuBlockrepeat, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified PlayerDanmakuBlockrepeat message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuBlockrepeat.verify|verify} messages.
                         * @param message PlayerDanmakuBlockrepeat message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.IPlayerDanmakuBlockrepeat, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a PlayerDanmakuBlockrepeat message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns PlayerDanmakuBlockrepeat
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.PlayerDanmakuBlockrepeat;

                        /**
                         * Decodes a PlayerDanmakuBlockrepeat message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns PlayerDanmakuBlockrepeat
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.PlayerDanmakuBlockrepeat;

                        /**
                         * Verifies a PlayerDanmakuBlockrepeat message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a PlayerDanmakuBlockrepeat message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns PlayerDanmakuBlockrepeat
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.PlayerDanmakuBlockrepeat;

                        /**
                         * Creates a plain object from a PlayerDanmakuBlockrepeat message. Also converts values to other types if specified.
                         * @param message PlayerDanmakuBlockrepeat
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.PlayerDanmakuBlockrepeat, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this PlayerDanmakuBlockrepeat to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for PlayerDanmakuBlockrepeat
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** Properties of a PlayerDanmakuBlockscroll. */
                    interface IPlayerDanmakuBlockscroll {

                        /** PlayerDanmakuBlockscroll value */
                        value?: (boolean|null);
                    }

                    /** Represents a PlayerDanmakuBlockscroll. */
                    class PlayerDanmakuBlockscroll implements IPlayerDanmakuBlockscroll {

                        /**
                         * Constructs a new PlayerDanmakuBlockscroll.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.IPlayerDanmakuBlockscroll);

                        /** PlayerDanmakuBlockscroll value. */
                        public value: boolean;

                        /**
                         * Creates a new PlayerDanmakuBlockscroll instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns PlayerDanmakuBlockscroll instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.IPlayerDanmakuBlockscroll): bilibili.community.service.dm.v1.PlayerDanmakuBlockscroll;

                        /**
                         * Encodes the specified PlayerDanmakuBlockscroll message. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuBlockscroll.verify|verify} messages.
                         * @param message PlayerDanmakuBlockscroll message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.IPlayerDanmakuBlockscroll, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified PlayerDanmakuBlockscroll message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuBlockscroll.verify|verify} messages.
                         * @param message PlayerDanmakuBlockscroll message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.IPlayerDanmakuBlockscroll, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a PlayerDanmakuBlockscroll message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns PlayerDanmakuBlockscroll
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.PlayerDanmakuBlockscroll;

                        /**
                         * Decodes a PlayerDanmakuBlockscroll message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns PlayerDanmakuBlockscroll
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.PlayerDanmakuBlockscroll;

                        /**
                         * Verifies a PlayerDanmakuBlockscroll message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a PlayerDanmakuBlockscroll message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns PlayerDanmakuBlockscroll
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.PlayerDanmakuBlockscroll;

                        /**
                         * Creates a plain object from a PlayerDanmakuBlockscroll message. Also converts values to other types if specified.
                         * @param message PlayerDanmakuBlockscroll
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.PlayerDanmakuBlockscroll, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this PlayerDanmakuBlockscroll to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for PlayerDanmakuBlockscroll
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** Properties of a PlayerDanmakuBlockspecial. */
                    interface IPlayerDanmakuBlockspecial {

                        /** PlayerDanmakuBlockspecial value */
                        value?: (boolean|null);
                    }

                    /** Represents a PlayerDanmakuBlockspecial. */
                    class PlayerDanmakuBlockspecial implements IPlayerDanmakuBlockspecial {

                        /**
                         * Constructs a new PlayerDanmakuBlockspecial.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.IPlayerDanmakuBlockspecial);

                        /** PlayerDanmakuBlockspecial value. */
                        public value: boolean;

                        /**
                         * Creates a new PlayerDanmakuBlockspecial instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns PlayerDanmakuBlockspecial instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.IPlayerDanmakuBlockspecial): bilibili.community.service.dm.v1.PlayerDanmakuBlockspecial;

                        /**
                         * Encodes the specified PlayerDanmakuBlockspecial message. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuBlockspecial.verify|verify} messages.
                         * @param message PlayerDanmakuBlockspecial message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.IPlayerDanmakuBlockspecial, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified PlayerDanmakuBlockspecial message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuBlockspecial.verify|verify} messages.
                         * @param message PlayerDanmakuBlockspecial message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.IPlayerDanmakuBlockspecial, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a PlayerDanmakuBlockspecial message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns PlayerDanmakuBlockspecial
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.PlayerDanmakuBlockspecial;

                        /**
                         * Decodes a PlayerDanmakuBlockspecial message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns PlayerDanmakuBlockspecial
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.PlayerDanmakuBlockspecial;

                        /**
                         * Verifies a PlayerDanmakuBlockspecial message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a PlayerDanmakuBlockspecial message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns PlayerDanmakuBlockspecial
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.PlayerDanmakuBlockspecial;

                        /**
                         * Creates a plain object from a PlayerDanmakuBlockspecial message. Also converts values to other types if specified.
                         * @param message PlayerDanmakuBlockspecial
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.PlayerDanmakuBlockspecial, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this PlayerDanmakuBlockspecial to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for PlayerDanmakuBlockspecial
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** Properties of a PlayerDanmakuBlocktop. */
                    interface IPlayerDanmakuBlocktop {

                        /** PlayerDanmakuBlocktop value */
                        value?: (boolean|null);
                    }

                    /** Represents a PlayerDanmakuBlocktop. */
                    class PlayerDanmakuBlocktop implements IPlayerDanmakuBlocktop {

                        /**
                         * Constructs a new PlayerDanmakuBlocktop.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.IPlayerDanmakuBlocktop);

                        /** PlayerDanmakuBlocktop value. */
                        public value: boolean;

                        /**
                         * Creates a new PlayerDanmakuBlocktop instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns PlayerDanmakuBlocktop instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.IPlayerDanmakuBlocktop): bilibili.community.service.dm.v1.PlayerDanmakuBlocktop;

                        /**
                         * Encodes the specified PlayerDanmakuBlocktop message. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuBlocktop.verify|verify} messages.
                         * @param message PlayerDanmakuBlocktop message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.IPlayerDanmakuBlocktop, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified PlayerDanmakuBlocktop message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuBlocktop.verify|verify} messages.
                         * @param message PlayerDanmakuBlocktop message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.IPlayerDanmakuBlocktop, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a PlayerDanmakuBlocktop message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns PlayerDanmakuBlocktop
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.PlayerDanmakuBlocktop;

                        /**
                         * Decodes a PlayerDanmakuBlocktop message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns PlayerDanmakuBlocktop
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.PlayerDanmakuBlocktop;

                        /**
                         * Verifies a PlayerDanmakuBlocktop message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a PlayerDanmakuBlocktop message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns PlayerDanmakuBlocktop
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.PlayerDanmakuBlocktop;

                        /**
                         * Creates a plain object from a PlayerDanmakuBlocktop message. Also converts values to other types if specified.
                         * @param message PlayerDanmakuBlocktop
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.PlayerDanmakuBlocktop, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this PlayerDanmakuBlocktop to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for PlayerDanmakuBlocktop
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** Properties of a PlayerDanmakuDomain. */
                    interface IPlayerDanmakuDomain {

                        /** PlayerDanmakuDomain value */
                        value?: (number|null);
                    }

                    /** Represents a PlayerDanmakuDomain. */
                    class PlayerDanmakuDomain implements IPlayerDanmakuDomain {

                        /**
                         * Constructs a new PlayerDanmakuDomain.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.IPlayerDanmakuDomain);

                        /** PlayerDanmakuDomain value. */
                        public value: number;

                        /**
                         * Creates a new PlayerDanmakuDomain instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns PlayerDanmakuDomain instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.IPlayerDanmakuDomain): bilibili.community.service.dm.v1.PlayerDanmakuDomain;

                        /**
                         * Encodes the specified PlayerDanmakuDomain message. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuDomain.verify|verify} messages.
                         * @param message PlayerDanmakuDomain message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.IPlayerDanmakuDomain, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified PlayerDanmakuDomain message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuDomain.verify|verify} messages.
                         * @param message PlayerDanmakuDomain message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.IPlayerDanmakuDomain, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a PlayerDanmakuDomain message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns PlayerDanmakuDomain
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.PlayerDanmakuDomain;

                        /**
                         * Decodes a PlayerDanmakuDomain message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns PlayerDanmakuDomain
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.PlayerDanmakuDomain;

                        /**
                         * Verifies a PlayerDanmakuDomain message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a PlayerDanmakuDomain message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns PlayerDanmakuDomain
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.PlayerDanmakuDomain;

                        /**
                         * Creates a plain object from a PlayerDanmakuDomain message. Also converts values to other types if specified.
                         * @param message PlayerDanmakuDomain
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.PlayerDanmakuDomain, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this PlayerDanmakuDomain to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for PlayerDanmakuDomain
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** Properties of a PlayerDanmakuEnableblocklist. */
                    interface IPlayerDanmakuEnableblocklist {

                        /** PlayerDanmakuEnableblocklist value */
                        value?: (boolean|null);
                    }

                    /** Represents a PlayerDanmakuEnableblocklist. */
                    class PlayerDanmakuEnableblocklist implements IPlayerDanmakuEnableblocklist {

                        /**
                         * Constructs a new PlayerDanmakuEnableblocklist.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.IPlayerDanmakuEnableblocklist);

                        /** PlayerDanmakuEnableblocklist value. */
                        public value: boolean;

                        /**
                         * Creates a new PlayerDanmakuEnableblocklist instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns PlayerDanmakuEnableblocklist instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.IPlayerDanmakuEnableblocklist): bilibili.community.service.dm.v1.PlayerDanmakuEnableblocklist;

                        /**
                         * Encodes the specified PlayerDanmakuEnableblocklist message. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuEnableblocklist.verify|verify} messages.
                         * @param message PlayerDanmakuEnableblocklist message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.IPlayerDanmakuEnableblocklist, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified PlayerDanmakuEnableblocklist message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuEnableblocklist.verify|verify} messages.
                         * @param message PlayerDanmakuEnableblocklist message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.IPlayerDanmakuEnableblocklist, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a PlayerDanmakuEnableblocklist message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns PlayerDanmakuEnableblocklist
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.PlayerDanmakuEnableblocklist;

                        /**
                         * Decodes a PlayerDanmakuEnableblocklist message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns PlayerDanmakuEnableblocklist
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.PlayerDanmakuEnableblocklist;

                        /**
                         * Verifies a PlayerDanmakuEnableblocklist message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a PlayerDanmakuEnableblocklist message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns PlayerDanmakuEnableblocklist
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.PlayerDanmakuEnableblocklist;

                        /**
                         * Creates a plain object from a PlayerDanmakuEnableblocklist message. Also converts values to other types if specified.
                         * @param message PlayerDanmakuEnableblocklist
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.PlayerDanmakuEnableblocklist, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this PlayerDanmakuEnableblocklist to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for PlayerDanmakuEnableblocklist
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** Properties of a PlayerDanmakuOpacity. */
                    interface IPlayerDanmakuOpacity {

                        /** PlayerDanmakuOpacity value */
                        value?: (number|null);
                    }

                    /** Represents a PlayerDanmakuOpacity. */
                    class PlayerDanmakuOpacity implements IPlayerDanmakuOpacity {

                        /**
                         * Constructs a new PlayerDanmakuOpacity.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.IPlayerDanmakuOpacity);

                        /** PlayerDanmakuOpacity value. */
                        public value: number;

                        /**
                         * Creates a new PlayerDanmakuOpacity instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns PlayerDanmakuOpacity instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.IPlayerDanmakuOpacity): bilibili.community.service.dm.v1.PlayerDanmakuOpacity;

                        /**
                         * Encodes the specified PlayerDanmakuOpacity message. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuOpacity.verify|verify} messages.
                         * @param message PlayerDanmakuOpacity message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.IPlayerDanmakuOpacity, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified PlayerDanmakuOpacity message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuOpacity.verify|verify} messages.
                         * @param message PlayerDanmakuOpacity message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.IPlayerDanmakuOpacity, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a PlayerDanmakuOpacity message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns PlayerDanmakuOpacity
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.PlayerDanmakuOpacity;

                        /**
                         * Decodes a PlayerDanmakuOpacity message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns PlayerDanmakuOpacity
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.PlayerDanmakuOpacity;

                        /**
                         * Verifies a PlayerDanmakuOpacity message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a PlayerDanmakuOpacity message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns PlayerDanmakuOpacity
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.PlayerDanmakuOpacity;

                        /**
                         * Creates a plain object from a PlayerDanmakuOpacity message. Also converts values to other types if specified.
                         * @param message PlayerDanmakuOpacity
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.PlayerDanmakuOpacity, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this PlayerDanmakuOpacity to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for PlayerDanmakuOpacity
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** Properties of a PlayerDanmakuScalingfactor. */
                    interface IPlayerDanmakuScalingfactor {

                        /** PlayerDanmakuScalingfactor value */
                        value?: (number|null);
                    }

                    /** Represents a PlayerDanmakuScalingfactor. */
                    class PlayerDanmakuScalingfactor implements IPlayerDanmakuScalingfactor {

                        /**
                         * Constructs a new PlayerDanmakuScalingfactor.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.IPlayerDanmakuScalingfactor);

                        /** PlayerDanmakuScalingfactor value. */
                        public value: number;

                        /**
                         * Creates a new PlayerDanmakuScalingfactor instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns PlayerDanmakuScalingfactor instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.IPlayerDanmakuScalingfactor): bilibili.community.service.dm.v1.PlayerDanmakuScalingfactor;

                        /**
                         * Encodes the specified PlayerDanmakuScalingfactor message. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuScalingfactor.verify|verify} messages.
                         * @param message PlayerDanmakuScalingfactor message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.IPlayerDanmakuScalingfactor, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified PlayerDanmakuScalingfactor message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuScalingfactor.verify|verify} messages.
                         * @param message PlayerDanmakuScalingfactor message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.IPlayerDanmakuScalingfactor, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a PlayerDanmakuScalingfactor message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns PlayerDanmakuScalingfactor
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.PlayerDanmakuScalingfactor;

                        /**
                         * Decodes a PlayerDanmakuScalingfactor message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns PlayerDanmakuScalingfactor
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.PlayerDanmakuScalingfactor;

                        /**
                         * Verifies a PlayerDanmakuScalingfactor message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a PlayerDanmakuScalingfactor message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns PlayerDanmakuScalingfactor
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.PlayerDanmakuScalingfactor;

                        /**
                         * Creates a plain object from a PlayerDanmakuScalingfactor message. Also converts values to other types if specified.
                         * @param message PlayerDanmakuScalingfactor
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.PlayerDanmakuScalingfactor, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this PlayerDanmakuScalingfactor to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for PlayerDanmakuScalingfactor
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** Properties of a PlayerDanmakuSeniorModeSwitch. */
                    interface IPlayerDanmakuSeniorModeSwitch {

                        /** PlayerDanmakuSeniorModeSwitch value */
                        value?: (number|null);
                    }

                    /** Represents a PlayerDanmakuSeniorModeSwitch. */
                    class PlayerDanmakuSeniorModeSwitch implements IPlayerDanmakuSeniorModeSwitch {

                        /**
                         * Constructs a new PlayerDanmakuSeniorModeSwitch.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.IPlayerDanmakuSeniorModeSwitch);

                        /** PlayerDanmakuSeniorModeSwitch value. */
                        public value: number;

                        /**
                         * Creates a new PlayerDanmakuSeniorModeSwitch instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns PlayerDanmakuSeniorModeSwitch instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.IPlayerDanmakuSeniorModeSwitch): bilibili.community.service.dm.v1.PlayerDanmakuSeniorModeSwitch;

                        /**
                         * Encodes the specified PlayerDanmakuSeniorModeSwitch message. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuSeniorModeSwitch.verify|verify} messages.
                         * @param message PlayerDanmakuSeniorModeSwitch message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.IPlayerDanmakuSeniorModeSwitch, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified PlayerDanmakuSeniorModeSwitch message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuSeniorModeSwitch.verify|verify} messages.
                         * @param message PlayerDanmakuSeniorModeSwitch message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.IPlayerDanmakuSeniorModeSwitch, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a PlayerDanmakuSeniorModeSwitch message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns PlayerDanmakuSeniorModeSwitch
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.PlayerDanmakuSeniorModeSwitch;

                        /**
                         * Decodes a PlayerDanmakuSeniorModeSwitch message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns PlayerDanmakuSeniorModeSwitch
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.PlayerDanmakuSeniorModeSwitch;

                        /**
                         * Verifies a PlayerDanmakuSeniorModeSwitch message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a PlayerDanmakuSeniorModeSwitch message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns PlayerDanmakuSeniorModeSwitch
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.PlayerDanmakuSeniorModeSwitch;

                        /**
                         * Creates a plain object from a PlayerDanmakuSeniorModeSwitch message. Also converts values to other types if specified.
                         * @param message PlayerDanmakuSeniorModeSwitch
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.PlayerDanmakuSeniorModeSwitch, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this PlayerDanmakuSeniorModeSwitch to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for PlayerDanmakuSeniorModeSwitch
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** Properties of a PlayerDanmakuSpeed. */
                    interface IPlayerDanmakuSpeed {

                        /** PlayerDanmakuSpeed value */
                        value?: (number|null);
                    }

                    /** Represents a PlayerDanmakuSpeed. */
                    class PlayerDanmakuSpeed implements IPlayerDanmakuSpeed {

                        /**
                         * Constructs a new PlayerDanmakuSpeed.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.IPlayerDanmakuSpeed);

                        /** PlayerDanmakuSpeed value. */
                        public value: number;

                        /**
                         * Creates a new PlayerDanmakuSpeed instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns PlayerDanmakuSpeed instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.IPlayerDanmakuSpeed): bilibili.community.service.dm.v1.PlayerDanmakuSpeed;

                        /**
                         * Encodes the specified PlayerDanmakuSpeed message. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuSpeed.verify|verify} messages.
                         * @param message PlayerDanmakuSpeed message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.IPlayerDanmakuSpeed, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified PlayerDanmakuSpeed message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuSpeed.verify|verify} messages.
                         * @param message PlayerDanmakuSpeed message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.IPlayerDanmakuSpeed, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a PlayerDanmakuSpeed message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns PlayerDanmakuSpeed
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.PlayerDanmakuSpeed;

                        /**
                         * Decodes a PlayerDanmakuSpeed message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns PlayerDanmakuSpeed
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.PlayerDanmakuSpeed;

                        /**
                         * Verifies a PlayerDanmakuSpeed message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a PlayerDanmakuSpeed message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns PlayerDanmakuSpeed
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.PlayerDanmakuSpeed;

                        /**
                         * Creates a plain object from a PlayerDanmakuSpeed message. Also converts values to other types if specified.
                         * @param message PlayerDanmakuSpeed
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.PlayerDanmakuSpeed, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this PlayerDanmakuSpeed to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for PlayerDanmakuSpeed
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** Properties of a PlayerDanmakuSwitch. */
                    interface IPlayerDanmakuSwitch {

                        /** PlayerDanmakuSwitch value */
                        value?: (boolean|null);

                        /** PlayerDanmakuSwitch canIgnore */
                        canIgnore?: (boolean|null);
                    }

                    /** Represents a PlayerDanmakuSwitch. */
                    class PlayerDanmakuSwitch implements IPlayerDanmakuSwitch {

                        /**
                         * Constructs a new PlayerDanmakuSwitch.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.IPlayerDanmakuSwitch);

                        /** PlayerDanmakuSwitch value. */
                        public value: boolean;

                        /** PlayerDanmakuSwitch canIgnore. */
                        public canIgnore: boolean;

                        /**
                         * Creates a new PlayerDanmakuSwitch instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns PlayerDanmakuSwitch instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.IPlayerDanmakuSwitch): bilibili.community.service.dm.v1.PlayerDanmakuSwitch;

                        /**
                         * Encodes the specified PlayerDanmakuSwitch message. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuSwitch.verify|verify} messages.
                         * @param message PlayerDanmakuSwitch message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.IPlayerDanmakuSwitch, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified PlayerDanmakuSwitch message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuSwitch.verify|verify} messages.
                         * @param message PlayerDanmakuSwitch message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.IPlayerDanmakuSwitch, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a PlayerDanmakuSwitch message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns PlayerDanmakuSwitch
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.PlayerDanmakuSwitch;

                        /**
                         * Decodes a PlayerDanmakuSwitch message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns PlayerDanmakuSwitch
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.PlayerDanmakuSwitch;

                        /**
                         * Verifies a PlayerDanmakuSwitch message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a PlayerDanmakuSwitch message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns PlayerDanmakuSwitch
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.PlayerDanmakuSwitch;

                        /**
                         * Creates a plain object from a PlayerDanmakuSwitch message. Also converts values to other types if specified.
                         * @param message PlayerDanmakuSwitch
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.PlayerDanmakuSwitch, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this PlayerDanmakuSwitch to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for PlayerDanmakuSwitch
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** Properties of a PlayerDanmakuSwitchSave. */
                    interface IPlayerDanmakuSwitchSave {

                        /** PlayerDanmakuSwitchSave value */
                        value?: (boolean|null);
                    }

                    /** Represents a PlayerDanmakuSwitchSave. */
                    class PlayerDanmakuSwitchSave implements IPlayerDanmakuSwitchSave {

                        /**
                         * Constructs a new PlayerDanmakuSwitchSave.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.IPlayerDanmakuSwitchSave);

                        /** PlayerDanmakuSwitchSave value. */
                        public value: boolean;

                        /**
                         * Creates a new PlayerDanmakuSwitchSave instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns PlayerDanmakuSwitchSave instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.IPlayerDanmakuSwitchSave): bilibili.community.service.dm.v1.PlayerDanmakuSwitchSave;

                        /**
                         * Encodes the specified PlayerDanmakuSwitchSave message. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuSwitchSave.verify|verify} messages.
                         * @param message PlayerDanmakuSwitchSave message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.IPlayerDanmakuSwitchSave, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified PlayerDanmakuSwitchSave message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuSwitchSave.verify|verify} messages.
                         * @param message PlayerDanmakuSwitchSave message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.IPlayerDanmakuSwitchSave, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a PlayerDanmakuSwitchSave message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns PlayerDanmakuSwitchSave
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.PlayerDanmakuSwitchSave;

                        /**
                         * Decodes a PlayerDanmakuSwitchSave message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns PlayerDanmakuSwitchSave
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.PlayerDanmakuSwitchSave;

                        /**
                         * Verifies a PlayerDanmakuSwitchSave message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a PlayerDanmakuSwitchSave message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns PlayerDanmakuSwitchSave
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.PlayerDanmakuSwitchSave;

                        /**
                         * Creates a plain object from a PlayerDanmakuSwitchSave message. Also converts values to other types if specified.
                         * @param message PlayerDanmakuSwitchSave
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.PlayerDanmakuSwitchSave, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this PlayerDanmakuSwitchSave to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for PlayerDanmakuSwitchSave
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** Properties of a PlayerDanmakuUseDefaultConfig. */
                    interface IPlayerDanmakuUseDefaultConfig {

                        /** PlayerDanmakuUseDefaultConfig value */
                        value?: (boolean|null);
                    }

                    /** Represents a PlayerDanmakuUseDefaultConfig. */
                    class PlayerDanmakuUseDefaultConfig implements IPlayerDanmakuUseDefaultConfig {

                        /**
                         * Constructs a new PlayerDanmakuUseDefaultConfig.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.IPlayerDanmakuUseDefaultConfig);

                        /** PlayerDanmakuUseDefaultConfig value. */
                        public value: boolean;

                        /**
                         * Creates a new PlayerDanmakuUseDefaultConfig instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns PlayerDanmakuUseDefaultConfig instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.IPlayerDanmakuUseDefaultConfig): bilibili.community.service.dm.v1.PlayerDanmakuUseDefaultConfig;

                        /**
                         * Encodes the specified PlayerDanmakuUseDefaultConfig message. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuUseDefaultConfig.verify|verify} messages.
                         * @param message PlayerDanmakuUseDefaultConfig message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.IPlayerDanmakuUseDefaultConfig, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified PlayerDanmakuUseDefaultConfig message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.PlayerDanmakuUseDefaultConfig.verify|verify} messages.
                         * @param message PlayerDanmakuUseDefaultConfig message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.IPlayerDanmakuUseDefaultConfig, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a PlayerDanmakuUseDefaultConfig message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns PlayerDanmakuUseDefaultConfig
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.PlayerDanmakuUseDefaultConfig;

                        /**
                         * Decodes a PlayerDanmakuUseDefaultConfig message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns PlayerDanmakuUseDefaultConfig
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.PlayerDanmakuUseDefaultConfig;

                        /**
                         * Verifies a PlayerDanmakuUseDefaultConfig message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a PlayerDanmakuUseDefaultConfig message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns PlayerDanmakuUseDefaultConfig
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.PlayerDanmakuUseDefaultConfig;

                        /**
                         * Creates a plain object from a PlayerDanmakuUseDefaultConfig message. Also converts values to other types if specified.
                         * @param message PlayerDanmakuUseDefaultConfig
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.PlayerDanmakuUseDefaultConfig, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this PlayerDanmakuUseDefaultConfig to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for PlayerDanmakuUseDefaultConfig
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** Properties of a PostPanel. */
                    interface IPostPanel {

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
                        clickButton?: (bilibili.community.service.dm.v1.IClickButton|null);

                        /** PostPanel textInput */
                        textInput?: (bilibili.community.service.dm.v1.ITextInput|null);

                        /** PostPanel checkBox */
                        checkBox?: (bilibili.community.service.dm.v1.ICheckBox|null);

                        /** PostPanel toast */
                        toast?: (bilibili.community.service.dm.v1.IToast|null);
                    }

                    /** Represents a PostPanel. */
                    class PostPanel implements IPostPanel {

                        /**
                         * Constructs a new PostPanel.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.IPostPanel);

                        /** PostPanel start. */
                        public start: (number|Long);

                        /** PostPanel end. */
                        public end: (number|Long);

                        /** PostPanel priority. */
                        public priority: (number|Long);

                        /** PostPanel bizId. */
                        public bizId: (number|Long);

                        /** PostPanel bizType. */
                        public bizType: bilibili.community.service.dm.v1.PostPanelBizType;

                        /** PostPanel clickButton. */
                        public clickButton?: (bilibili.community.service.dm.v1.IClickButton|null);

                        /** PostPanel textInput. */
                        public textInput?: (bilibili.community.service.dm.v1.ITextInput|null);

                        /** PostPanel checkBox. */
                        public checkBox?: (bilibili.community.service.dm.v1.ICheckBox|null);

                        /** PostPanel toast. */
                        public toast?: (bilibili.community.service.dm.v1.IToast|null);

                        /**
                         * Creates a new PostPanel instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns PostPanel instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.IPostPanel): bilibili.community.service.dm.v1.PostPanel;

                        /**
                         * Encodes the specified PostPanel message. Does not implicitly {@link bilibili.community.service.dm.v1.PostPanel.verify|verify} messages.
                         * @param message PostPanel message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.IPostPanel, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified PostPanel message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.PostPanel.verify|verify} messages.
                         * @param message PostPanel message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.IPostPanel, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a PostPanel message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns PostPanel
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.PostPanel;

                        /**
                         * Decodes a PostPanel message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns PostPanel
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.PostPanel;

                        /**
                         * Verifies a PostPanel message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a PostPanel message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns PostPanel
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.PostPanel;

                        /**
                         * Creates a plain object from a PostPanel message. Also converts values to other types if specified.
                         * @param message PostPanel
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.PostPanel, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this PostPanel to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for PostPanel
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** PostPanelBizType enum. */
                    enum PostPanelBizType {
                        PostPanelBizTypeNone = 0,
                        PostPanelBizTypeEncourage = 1,
                        PostPanelBizTypeColorDM = 2,
                        PostPanelBizTypeNFTDM = 3,
                        PostPanelBizTypeFragClose = 4,
                        PostPanelBizTypeRecommend = 5
                    }

                    /** Properties of a PostPanelV2. */
                    interface IPostPanelV2 {

                        /** PostPanelV2 start */
                        start?: (number|Long|null);

                        /** PostPanelV2 end */
                        end?: (number|Long|null);

                        /** PostPanelV2 bizType */
                        bizType?: (number|null);

                        /** PostPanelV2 clickButton */
                        clickButton?: (bilibili.community.service.dm.v1.IClickButtonV2|null);

                        /** PostPanelV2 textInput */
                        textInput?: (bilibili.community.service.dm.v1.ITextInputV2|null);

                        /** PostPanelV2 checkBox */
                        checkBox?: (bilibili.community.service.dm.v1.ICheckBoxV2|null);

                        /** PostPanelV2 toast */
                        toast?: (bilibili.community.service.dm.v1.IToastV2|null);

                        /** PostPanelV2 bubble */
                        bubble?: (bilibili.community.service.dm.v1.IBubbleV2|null);

                        /** PostPanelV2 label */
                        label?: (bilibili.community.service.dm.v1.ILabelV2|null);

                        /** PostPanelV2 postStatus */
                        postStatus?: (number|null);
                    }

                    /** Represents a PostPanelV2. */
                    class PostPanelV2 implements IPostPanelV2 {

                        /**
                         * Constructs a new PostPanelV2.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.IPostPanelV2);

                        /** PostPanelV2 start. */
                        public start: (number|Long);

                        /** PostPanelV2 end. */
                        public end: (number|Long);

                        /** PostPanelV2 bizType. */
                        public bizType: number;

                        /** PostPanelV2 clickButton. */
                        public clickButton?: (bilibili.community.service.dm.v1.IClickButtonV2|null);

                        /** PostPanelV2 textInput. */
                        public textInput?: (bilibili.community.service.dm.v1.ITextInputV2|null);

                        /** PostPanelV2 checkBox. */
                        public checkBox?: (bilibili.community.service.dm.v1.ICheckBoxV2|null);

                        /** PostPanelV2 toast. */
                        public toast?: (bilibili.community.service.dm.v1.IToastV2|null);

                        /** PostPanelV2 bubble. */
                        public bubble?: (bilibili.community.service.dm.v1.IBubbleV2|null);

                        /** PostPanelV2 label. */
                        public label?: (bilibili.community.service.dm.v1.ILabelV2|null);

                        /** PostPanelV2 postStatus. */
                        public postStatus: number;

                        /**
                         * Creates a new PostPanelV2 instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns PostPanelV2 instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.IPostPanelV2): bilibili.community.service.dm.v1.PostPanelV2;

                        /**
                         * Encodes the specified PostPanelV2 message. Does not implicitly {@link bilibili.community.service.dm.v1.PostPanelV2.verify|verify} messages.
                         * @param message PostPanelV2 message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.IPostPanelV2, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified PostPanelV2 message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.PostPanelV2.verify|verify} messages.
                         * @param message PostPanelV2 message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.IPostPanelV2, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a PostPanelV2 message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns PostPanelV2
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.PostPanelV2;

                        /**
                         * Decodes a PostPanelV2 message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns PostPanelV2
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.PostPanelV2;

                        /**
                         * Verifies a PostPanelV2 message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a PostPanelV2 message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns PostPanelV2
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.PostPanelV2;

                        /**
                         * Creates a plain object from a PostPanelV2 message. Also converts values to other types if specified.
                         * @param message PostPanelV2
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.PostPanelV2, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this PostPanelV2 to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for PostPanelV2
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** PostStatus enum. */
                    enum PostStatus {
                        PostStatusNormal = 0,
                        PostStatusClosed = 1
                    }

                    /** RenderType enum. */
                    enum RenderType {
                        RenderTypeNone = 0,
                        RenderTypeSingle = 1,
                        RenderTypeRotation = 2
                    }

                    /** Properties of a Response. */
                    interface IResponse {

                        /** Response code */
                        code?: (number|null);

                        /** Response message */
                        message?: (string|null);
                    }

                    /** Represents a Response. */
                    class Response implements IResponse {

                        /**
                         * Constructs a new Response.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.IResponse);

                        /** Response code. */
                        public code: number;

                        /** Response message. */
                        public message: string;

                        /**
                         * Creates a new Response instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns Response instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.IResponse): bilibili.community.service.dm.v1.Response;

                        /**
                         * Encodes the specified Response message. Does not implicitly {@link bilibili.community.service.dm.v1.Response.verify|verify} messages.
                         * @param message Response message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.IResponse, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified Response message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.Response.verify|verify} messages.
                         * @param message Response message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.IResponse, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a Response message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns Response
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.Response;

                        /**
                         * Decodes a Response message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns Response
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.Response;

                        /**
                         * Verifies a Response message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a Response message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns Response
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.Response;

                        /**
                         * Creates a plain object from a Response message. Also converts values to other types if specified.
                         * @param message Response
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.Response, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this Response to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for Response
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** SubtitleAiStatus enum. */
                    enum SubtitleAiStatus {
                        None = 0,
                        Exposure = 1,
                        Assist = 2
                    }

                    /** SubtitleAiType enum. */
                    enum SubtitleAiType {
                        Normal = 0,
                        Translate = 1
                    }

                    /** Properties of a SubtitleItem. */
                    interface ISubtitleItem {

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
                        author?: (bilibili.community.service.dm.v1.IUserInfo|null);

                        /** SubtitleItem type */
                        type?: (bilibili.community.service.dm.v1.SubtitleType|null);

                        /** SubtitleItem lanDocBrief */
                        lanDocBrief?: (string|null);

                        /** SubtitleItem aiType */
                        aiType?: (bilibili.community.service.dm.v1.SubtitleAiType|null);

                        /** SubtitleItem aiStatus */
                        aiStatus?: (bilibili.community.service.dm.v1.SubtitleAiStatus|null);
                    }

                    /** Represents a SubtitleItem. */
                    class SubtitleItem implements ISubtitleItem {

                        /**
                         * Constructs a new SubtitleItem.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.ISubtitleItem);

                        /** SubtitleItem id. */
                        public id: (number|Long);

                        /** SubtitleItem idStr. */
                        public idStr: string;

                        /** SubtitleItem lan. */
                        public lan: string;

                        /** SubtitleItem lanDoc. */
                        public lanDoc: string;

                        /** SubtitleItem subtitleUrl. */
                        public subtitleUrl: string;

                        /** SubtitleItem author. */
                        public author?: (bilibili.community.service.dm.v1.IUserInfo|null);

                        /** SubtitleItem type. */
                        public type: bilibili.community.service.dm.v1.SubtitleType;

                        /** SubtitleItem lanDocBrief. */
                        public lanDocBrief: string;

                        /** SubtitleItem aiType. */
                        public aiType: bilibili.community.service.dm.v1.SubtitleAiType;

                        /** SubtitleItem aiStatus. */
                        public aiStatus: bilibili.community.service.dm.v1.SubtitleAiStatus;

                        /**
                         * Creates a new SubtitleItem instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns SubtitleItem instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.ISubtitleItem): bilibili.community.service.dm.v1.SubtitleItem;

                        /**
                         * Encodes the specified SubtitleItem message. Does not implicitly {@link bilibili.community.service.dm.v1.SubtitleItem.verify|verify} messages.
                         * @param message SubtitleItem message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.ISubtitleItem, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified SubtitleItem message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.SubtitleItem.verify|verify} messages.
                         * @param message SubtitleItem message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.ISubtitleItem, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a SubtitleItem message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns SubtitleItem
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.SubtitleItem;

                        /**
                         * Decodes a SubtitleItem message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns SubtitleItem
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.SubtitleItem;

                        /**
                         * Verifies a SubtitleItem message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a SubtitleItem message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns SubtitleItem
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.SubtitleItem;

                        /**
                         * Creates a plain object from a SubtitleItem message. Also converts values to other types if specified.
                         * @param message SubtitleItem
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.SubtitleItem, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this SubtitleItem to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for SubtitleItem
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** SubtitleType enum. */
                    enum SubtitleType {
                        CC = 0,
                        AI = 1
                    }

                    /** Properties of a TextInput. */
                    interface ITextInput {

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
                        avatar?: (bilibili.community.service.dm.v1.IAvatar[]|null);

                        /** TextInput postStatus */
                        postStatus?: (bilibili.community.service.dm.v1.PostStatus|null);

                        /** TextInput label */
                        label?: (bilibili.community.service.dm.v1.ILabel|null);
                    }

                    /** Represents a TextInput. */
                    class TextInput implements ITextInput {

                        /**
                         * Constructs a new TextInput.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.ITextInput);

                        /** TextInput portraitPlaceholder. */
                        public portraitPlaceholder: string[];

                        /** TextInput landscapePlaceholder. */
                        public landscapePlaceholder: string[];

                        /** TextInput renderType. */
                        public renderType: bilibili.community.service.dm.v1.RenderType;

                        /** TextInput placeholderPost. */
                        public placeholderPost: boolean;

                        /** TextInput show. */
                        public show: boolean;

                        /** TextInput avatar. */
                        public avatar: bilibili.community.service.dm.v1.IAvatar[];

                        /** TextInput postStatus. */
                        public postStatus: bilibili.community.service.dm.v1.PostStatus;

                        /** TextInput label. */
                        public label?: (bilibili.community.service.dm.v1.ILabel|null);

                        /**
                         * Creates a new TextInput instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns TextInput instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.ITextInput): bilibili.community.service.dm.v1.TextInput;

                        /**
                         * Encodes the specified TextInput message. Does not implicitly {@link bilibili.community.service.dm.v1.TextInput.verify|verify} messages.
                         * @param message TextInput message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.ITextInput, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified TextInput message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.TextInput.verify|verify} messages.
                         * @param message TextInput message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.ITextInput, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a TextInput message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns TextInput
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.TextInput;

                        /**
                         * Decodes a TextInput message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns TextInput
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.TextInput;

                        /**
                         * Verifies a TextInput message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a TextInput message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns TextInput
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.TextInput;

                        /**
                         * Creates a plain object from a TextInput message. Also converts values to other types if specified.
                         * @param message TextInput
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.TextInput, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this TextInput to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for TextInput
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** Properties of a TextInputV2. */
                    interface ITextInputV2 {

                        /** TextInputV2 portraitPlaceholder */
                        portraitPlaceholder?: (string[]|null);

                        /** TextInputV2 landscapePlaceholder */
                        landscapePlaceholder?: (string[]|null);

                        /** TextInputV2 renderType */
                        renderType?: (bilibili.community.service.dm.v1.RenderType|null);

                        /** TextInputV2 placeholderPost */
                        placeholderPost?: (boolean|null);

                        /** TextInputV2 avatar */
                        avatar?: (bilibili.community.service.dm.v1.IAvatar[]|null);

                        /** TextInputV2 textInputLimit */
                        textInputLimit?: (number|null);
                    }

                    /** Represents a TextInputV2. */
                    class TextInputV2 implements ITextInputV2 {

                        /**
                         * Constructs a new TextInputV2.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.ITextInputV2);

                        /** TextInputV2 portraitPlaceholder. */
                        public portraitPlaceholder: string[];

                        /** TextInputV2 landscapePlaceholder. */
                        public landscapePlaceholder: string[];

                        /** TextInputV2 renderType. */
                        public renderType: bilibili.community.service.dm.v1.RenderType;

                        /** TextInputV2 placeholderPost. */
                        public placeholderPost: boolean;

                        /** TextInputV2 avatar. */
                        public avatar: bilibili.community.service.dm.v1.IAvatar[];

                        /** TextInputV2 textInputLimit. */
                        public textInputLimit: number;

                        /**
                         * Creates a new TextInputV2 instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns TextInputV2 instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.ITextInputV2): bilibili.community.service.dm.v1.TextInputV2;

                        /**
                         * Encodes the specified TextInputV2 message. Does not implicitly {@link bilibili.community.service.dm.v1.TextInputV2.verify|verify} messages.
                         * @param message TextInputV2 message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.ITextInputV2, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified TextInputV2 message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.TextInputV2.verify|verify} messages.
                         * @param message TextInputV2 message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.ITextInputV2, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a TextInputV2 message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns TextInputV2
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.TextInputV2;

                        /**
                         * Decodes a TextInputV2 message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns TextInputV2
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.TextInputV2;

                        /**
                         * Verifies a TextInputV2 message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a TextInputV2 message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns TextInputV2
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.TextInputV2;

                        /**
                         * Creates a plain object from a TextInputV2 message. Also converts values to other types if specified.
                         * @param message TextInputV2
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.TextInputV2, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this TextInputV2 to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for TextInputV2
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** Properties of a Toast. */
                    interface IToast {

                        /** Toast text */
                        text?: (string|null);

                        /** Toast duration */
                        duration?: (number|null);

                        /** Toast show */
                        show?: (boolean|null);

                        /** Toast button */
                        button?: (bilibili.community.service.dm.v1.IButton|null);
                    }

                    /** Represents a Toast. */
                    class Toast implements IToast {

                        /**
                         * Constructs a new Toast.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.IToast);

                        /** Toast text. */
                        public text: string;

                        /** Toast duration. */
                        public duration: number;

                        /** Toast show. */
                        public show: boolean;

                        /** Toast button. */
                        public button?: (bilibili.community.service.dm.v1.IButton|null);

                        /**
                         * Creates a new Toast instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns Toast instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.IToast): bilibili.community.service.dm.v1.Toast;

                        /**
                         * Encodes the specified Toast message. Does not implicitly {@link bilibili.community.service.dm.v1.Toast.verify|verify} messages.
                         * @param message Toast message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.IToast, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified Toast message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.Toast.verify|verify} messages.
                         * @param message Toast message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.IToast, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a Toast message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns Toast
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.Toast;

                        /**
                         * Decodes a Toast message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns Toast
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.Toast;

                        /**
                         * Verifies a Toast message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a Toast message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns Toast
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.Toast;

                        /**
                         * Creates a plain object from a Toast message. Also converts values to other types if specified.
                         * @param message Toast
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.Toast, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this Toast to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for Toast
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** Properties of a ToastButtonV2. */
                    interface IToastButtonV2 {

                        /** ToastButtonV2 text */
                        text?: (string|null);

                        /** ToastButtonV2 action */
                        action?: (number|null);
                    }

                    /** Represents a ToastButtonV2. */
                    class ToastButtonV2 implements IToastButtonV2 {

                        /**
                         * Constructs a new ToastButtonV2.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.IToastButtonV2);

                        /** ToastButtonV2 text. */
                        public text: string;

                        /** ToastButtonV2 action. */
                        public action: number;

                        /**
                         * Creates a new ToastButtonV2 instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns ToastButtonV2 instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.IToastButtonV2): bilibili.community.service.dm.v1.ToastButtonV2;

                        /**
                         * Encodes the specified ToastButtonV2 message. Does not implicitly {@link bilibili.community.service.dm.v1.ToastButtonV2.verify|verify} messages.
                         * @param message ToastButtonV2 message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.IToastButtonV2, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified ToastButtonV2 message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.ToastButtonV2.verify|verify} messages.
                         * @param message ToastButtonV2 message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.IToastButtonV2, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a ToastButtonV2 message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns ToastButtonV2
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.ToastButtonV2;

                        /**
                         * Decodes a ToastButtonV2 message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns ToastButtonV2
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.ToastButtonV2;

                        /**
                         * Verifies a ToastButtonV2 message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a ToastButtonV2 message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns ToastButtonV2
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.ToastButtonV2;

                        /**
                         * Creates a plain object from a ToastButtonV2 message. Also converts values to other types if specified.
                         * @param message ToastButtonV2
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.ToastButtonV2, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this ToastButtonV2 to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for ToastButtonV2
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** ToastFunctionType enum. */
                    enum ToastFunctionType {
                        ToastFunctionTypeNone = 0,
                        ToastFunctionTypePostPanel = 1
                    }

                    /** Properties of a ToastV2. */
                    interface IToastV2 {

                        /** ToastV2 text */
                        text?: (string|null);

                        /** ToastV2 duration */
                        duration?: (number|null);

                        /** ToastV2 toastButtonV2 */
                        toastButtonV2?: (bilibili.community.service.dm.v1.IToastButtonV2|null);
                    }

                    /** Represents a ToastV2. */
                    class ToastV2 implements IToastV2 {

                        /**
                         * Constructs a new ToastV2.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.IToastV2);

                        /** ToastV2 text. */
                        public text: string;

                        /** ToastV2 duration. */
                        public duration: number;

                        /** ToastV2 toastButtonV2. */
                        public toastButtonV2?: (bilibili.community.service.dm.v1.IToastButtonV2|null);

                        /**
                         * Creates a new ToastV2 instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns ToastV2 instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.IToastV2): bilibili.community.service.dm.v1.ToastV2;

                        /**
                         * Encodes the specified ToastV2 message. Does not implicitly {@link bilibili.community.service.dm.v1.ToastV2.verify|verify} messages.
                         * @param message ToastV2 message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.IToastV2, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified ToastV2 message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.ToastV2.verify|verify} messages.
                         * @param message ToastV2 message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.IToastV2, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a ToastV2 message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns ToastV2
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.ToastV2;

                        /**
                         * Decodes a ToastV2 message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns ToastV2
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.ToastV2;

                        /**
                         * Verifies a ToastV2 message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a ToastV2 message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns ToastV2
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.ToastV2;

                        /**
                         * Creates a plain object from a ToastV2 message. Also converts values to other types if specified.
                         * @param message ToastV2
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.ToastV2, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this ToastV2 to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for ToastV2
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** Properties of a UserInfo. */
                    interface IUserInfo {

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
                    }

                    /** Represents a UserInfo. */
                    class UserInfo implements IUserInfo {

                        /**
                         * Constructs a new UserInfo.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.IUserInfo);

                        /** UserInfo mid. */
                        public mid: (number|Long);

                        /** UserInfo name. */
                        public name: string;

                        /** UserInfo sex. */
                        public sex: string;

                        /** UserInfo face. */
                        public face: string;

                        /** UserInfo sign. */
                        public sign: string;

                        /** UserInfo rank. */
                        public rank: number;

                        /**
                         * Creates a new UserInfo instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns UserInfo instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.IUserInfo): bilibili.community.service.dm.v1.UserInfo;

                        /**
                         * Encodes the specified UserInfo message. Does not implicitly {@link bilibili.community.service.dm.v1.UserInfo.verify|verify} messages.
                         * @param message UserInfo message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.IUserInfo, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified UserInfo message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.UserInfo.verify|verify} messages.
                         * @param message UserInfo message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.IUserInfo, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a UserInfo message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns UserInfo
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.UserInfo;

                        /**
                         * Decodes a UserInfo message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns UserInfo
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.UserInfo;

                        /**
                         * Verifies a UserInfo message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a UserInfo message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns UserInfo
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.UserInfo;

                        /**
                         * Creates a plain object from a UserInfo message. Also converts values to other types if specified.
                         * @param message UserInfo
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.UserInfo, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this UserInfo to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for UserInfo
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** Properties of a VideoMask. */
                    interface IVideoMask {

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
                    }

                    /** Represents a VideoMask. */
                    class VideoMask implements IVideoMask {

                        /**
                         * Constructs a new VideoMask.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.IVideoMask);

                        /** VideoMask cid. */
                        public cid: (number|Long);

                        /** VideoMask plat. */
                        public plat: number;

                        /** VideoMask fps. */
                        public fps: number;

                        /** VideoMask time. */
                        public time: (number|Long);

                        /** VideoMask maskUrl. */
                        public maskUrl: string;

                        /**
                         * Creates a new VideoMask instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns VideoMask instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.IVideoMask): bilibili.community.service.dm.v1.VideoMask;

                        /**
                         * Encodes the specified VideoMask message. Does not implicitly {@link bilibili.community.service.dm.v1.VideoMask.verify|verify} messages.
                         * @param message VideoMask message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.IVideoMask, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified VideoMask message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.VideoMask.verify|verify} messages.
                         * @param message VideoMask message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.IVideoMask, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a VideoMask message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns VideoMask
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.VideoMask;

                        /**
                         * Decodes a VideoMask message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns VideoMask
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.VideoMask;

                        /**
                         * Verifies a VideoMask message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a VideoMask message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns VideoMask
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.VideoMask;

                        /**
                         * Creates a plain object from a VideoMask message. Also converts values to other types if specified.
                         * @param message VideoMask
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.VideoMask, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this VideoMask to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for VideoMask
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }

                    /** Properties of a VideoSubtitle. */
                    interface IVideoSubtitle {

                        /** VideoSubtitle lan */
                        lan?: (string|null);

                        /** VideoSubtitle lanDoc */
                        lanDoc?: (string|null);

                        /** VideoSubtitle subtitles */
                        subtitles?: (bilibili.community.service.dm.v1.ISubtitleItem[]|null);
                    }

                    /** Represents a VideoSubtitle. */
                    class VideoSubtitle implements IVideoSubtitle {

                        /**
                         * Constructs a new VideoSubtitle.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: bilibili.community.service.dm.v1.IVideoSubtitle);

                        /** VideoSubtitle lan. */
                        public lan: string;

                        /** VideoSubtitle lanDoc. */
                        public lanDoc: string;

                        /** VideoSubtitle subtitles. */
                        public subtitles: bilibili.community.service.dm.v1.ISubtitleItem[];

                        /**
                         * Creates a new VideoSubtitle instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns VideoSubtitle instance
                         */
                        public static create(properties?: bilibili.community.service.dm.v1.IVideoSubtitle): bilibili.community.service.dm.v1.VideoSubtitle;

                        /**
                         * Encodes the specified VideoSubtitle message. Does not implicitly {@link bilibili.community.service.dm.v1.VideoSubtitle.verify|verify} messages.
                         * @param message VideoSubtitle message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: bilibili.community.service.dm.v1.IVideoSubtitle, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified VideoSubtitle message, length delimited. Does not implicitly {@link bilibili.community.service.dm.v1.VideoSubtitle.verify|verify} messages.
                         * @param message VideoSubtitle message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: bilibili.community.service.dm.v1.IVideoSubtitle, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a VideoSubtitle message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns VideoSubtitle
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): bilibili.community.service.dm.v1.VideoSubtitle;

                        /**
                         * Decodes a VideoSubtitle message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns VideoSubtitle
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): bilibili.community.service.dm.v1.VideoSubtitle;

                        /**
                         * Verifies a VideoSubtitle message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a VideoSubtitle message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns VideoSubtitle
                         */
                        public static fromObject(object: { [k: string]: any }): bilibili.community.service.dm.v1.VideoSubtitle;

                        /**
                         * Creates a plain object from a VideoSubtitle message. Also converts values to other types if specified.
                         * @param message VideoSubtitle
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: bilibili.community.service.dm.v1.VideoSubtitle, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this VideoSubtitle to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for VideoSubtitle
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }
                }
            }
        }
    }
}
