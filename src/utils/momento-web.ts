import {
    CacheClient,
    Configurations,
    CredentialProvider,
    MomentoErrorCode,
    TopicClient,
    TopicItem,
    TopicPublish,
    TopicSubscribe,
} from "@gomomento/sdk-web";

export enum EventTypes {
    MESSAGE = 'message',
    USER_JOINED = 'user_joined'
}

export type ChatMessageEvent = {
    event: EventTypes.MESSAGE,
    username: string,
    text: string,
    timestamp: number;
}

export type UserJoinedEvent = {
    event: EventTypes.USER_JOINED,
    username: string,
    timestamp: number;
}

export type ChatEvent = UserJoinedEvent | ChatMessageEvent;

let webTopicClient: TopicClient | undefined = undefined;
let webCacheClient: CacheClient | undefined = undefined;
let subscription: TopicSubscribe.Subscription | undefined = undefined;
let onItemCb: (item: TopicItem) => void;
let onErrorCb: (error: TopicSubscribe.Error, subscription: TopicSubscribe.Subscription) => Promise<void>;

type MomentoClients = {
    topicClient: TopicClient;
    cacheClient: CacheClient;
}

async function getNewWebClients(): Promise<MomentoClients> {
    webTopicClient = undefined;
    const fetchResp = await fetch(window.location.origin + '/api/momento/token');
    const token = await fetchResp.text()
    const topicClient = new TopicClient({
        configuration: Configurations.Browser.v1(),
        credentialProvider: CredentialProvider.fromString(
            {
                authToken: token
            }
        ),
    });
    webTopicClient = topicClient;
    const cacheClient = new CacheClient({
        configuration: Configurations.Browser.v1(),
        credentialProvider: CredentialProvider.fromString(
            {
                authToken: token
            }
        ),
        defaultTtlSeconds: 60,
    });
    webCacheClient = cacheClient;
    return {
        cacheClient,
        topicClient
    };
}

export const clearCurrentClient = () => {
    subscription?.unsubscribe();
    webTopicClient = undefined;
    webCacheClient = undefined;
}

async function getWebTopicClient(): Promise<TopicClient> {
    if (webTopicClient) {
        return webTopicClient
    }

    const clients = await getNewWebClients();
    return clients.topicClient;
}

export async function listCaches(): Promise<string[]> {
    const fetchResp = await fetch(window.location.origin + '/api/momento/caches');
    const caches: string[] = await fetchResp.json()
    return caches
}

export async function subscribeToTopic(cacheName: string, topicName: string, onItem: (item: TopicItem) => void, onError: (error: TopicSubscribe.Error, subscription: TopicSubscribe.Subscription) => Promise<void>) {
    onErrorCb = onError;
    onItemCb = onItem
    const topicClient = await getWebTopicClient();
    const resp = await topicClient.subscribe(cacheName, topicName, {
        onItem: onItemCb, onError: onErrorCb
    });
    if (resp instanceof TopicSubscribe.Subscription) {
        subscription = resp;
        return subscription;
    }

    throw new Error(`unable to subscribe to topic: ${resp}`);
}

async function publish(cacheName: string, topicName: string, message: string) {
    const topicClient = await getWebTopicClient();
    const resp = await topicClient.publish(cacheName, topicName, message);
    if (resp instanceof TopicPublish.Error) {
        if (resp.errorCode() === MomentoErrorCode.AUTHENTICATION_ERROR) {
            console.log("token has expired, going to refresh subscription and retry publish")
            subscription?.unsubscribe();
            clearCurrentClient();
            await subscribeToTopic(cacheName, topicName, onItemCb, onErrorCb);
            await topicClient.publish(cacheName, topicName, message);
        } else {
            console.error("failed to publish to topic", resp);
        }
    }
}

export async function userJoined(cacheName: string, topicName: string, username: string) {
    const userJoinedEvent: UserJoinedEvent = { username, timestamp: Date.now(), event: EventTypes.USER_JOINED };
    await publish(cacheName, topicName, JSON.stringify(userJoinedEvent))
}

export async function sendMessage(cacheName: string, topicName: string, username: string, text: string) {
    const chatMessage: ChatMessageEvent = { username, text, timestamp: Date.now(), event: EventTypes.MESSAGE };
    await publish(cacheName, topicName, JSON.stringify(chatMessage))
}
