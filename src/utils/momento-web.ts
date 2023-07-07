import {
    Configurations,
    CredentialProvider,
    TopicClient,
    TopicSubscribe,
    TopicItem,
    CacheClient,
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
    const topicClient = await getWebTopicClient();
    return await topicClient.subscribe(cacheName, topicName, {
        onItem, onError
    })
}

export async function userJoined(cacheName: string, topicName: string, username: string) {
    const topicClient = await getWebTopicClient();
    const userJoinedEvent: UserJoinedEvent = { username, timestamp: Date.now(), event: EventTypes.USER_JOINED };
    await topicClient.publish(cacheName, topicName, JSON.stringify(userJoinedEvent))
}

export async function sendMessage(cacheName: string, topicName: string, username: string, text: string) {
    const topicClient = await getWebTopicClient();
    const chatMessage: ChatMessageEvent = { username, text, timestamp: Date.now(), event: EventTypes.MESSAGE };
    await topicClient.publish(cacheName, topicName, JSON.stringify(chatMessage))
}
