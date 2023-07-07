"use client"
import {useEffect, useState} from "react";

import {
    ChatEvent,
    clearCurrentClient,
    EventTypes,
    sendMessage,
    subscribeToTopic,
    userJoined
} from "@/utils/momento-web";
import {TopicItem, TopicSubscribe} from "@gomomento/sdk-web";

type Props = {
    topicName: string;
    cacheName: string;
    username: string;
}

export default function ChatRoom(props: Props) {
    const [chats, setChats] = useState<ChatEvent[]>([])
    const [textInput, setTextInput] = useState("")

    const onItem = (item: TopicItem) => {
        try {
            const message = JSON.parse(item.valueString()) as ChatEvent
            setChats(curr => [...curr, { ...message }])
        } catch (e) {
            console.error("unable to parse chat message", e)
        }
    }

    const onError = async (error: TopicSubscribe.Error, sub: TopicSubscribe.Subscription) => {
        console.error("received error from momento, getting new token and resubscribing", error)
        sub.unsubscribe();
        clearCurrentClient();
        await subscribeToTopic(props.cacheName, props.topicName, onItem, onError)
    }

    const onEnterClicked = async (e: { keyCode: number }) => {
        if (e.keyCode === 13) {
            await sendMessage(props.cacheName, props.topicName, props.username, textInput);
            setTextInput("");
        }
    }

    useEffect(() => {
        subscribeToTopic(props.cacheName, props.topicName, onItem, onError)
            .then(async () => {
                console.log("successfully subscribed")
                await userJoined(props.cacheName, props.topicName, props.username)
            })
            .catch((e) => console.error("error subscribing to topic", e))
    }, [])


    return (
        <div className={"flex flex-col p-6 h-full justify-between bg-slate-200"}>
            <div className={'border-b-2 border-slate-300 mb-4'}>Welcome to the <span className={'italic'}>{props.topicName}</span> chat room</div>
            <div className={"h-full overflow-auto"}>{chats.map(chat => {
                const date = new Date(chat.timestamp);
                const hours = date.getHours();
                const minutes = date.getMinutes();
                switch (chat.event) {
                    case EventTypes.MESSAGE:
                        const p = `[${hours}:${minutes}] <${chat.username}>`
                        return <div className={'break-words'} key={chat.timestamp}><span className={'text-red-500'}>{p}</span> {chat.text}</div>
                    case EventTypes.USER_JOINED:
                        return <div key={chat.timestamp} className={'text-green-500 italic'}>user joined: {chat.username}</div>
                }
            })}</div>
            <input placeholder={'chat'} onKeyDown={onEnterClicked} className={"border-2 rounded-2xl p-2"} value={textInput} onChange={(e) => setTextInput(e.target.value)}/>
        </div>

    )

}
