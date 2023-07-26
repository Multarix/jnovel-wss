import EventEmitter from "events";
import WebSocket from "ws";
import { IResponse } from "./src/types/interfaces";

const jnovelID = "INSERT JNOVEL ID HERE";

function newPart(part: any) {

	console.log(part);
	// This would be where I would send the part to discord

}

const jnovel = new EventEmitter();
jnovel.on("newPart", newPart.bind(null));


try {

	const ws = new WebSocket("ws://localhost:5683");

	let uuid: string = '';

	ws.on("open", () => {

		console.log("Connected to websocket.");

	});

	ws.on("message", (message) => {

		const res: IResponse = JSON.parse(message.toString());
		console.log(res);

		if(res.status === 210){

			if(!res.newParts) return;
			for(const part of res.newParts){

				jnovel.emit("newPart", part);

			}
			return ws.send(JSON.stringify({ status: 200, uuid }));

		}

		if(res.establish && res.uuid){

			uuid = res.uuid;
			console.log(`Assigned id: ${uuid}`);
			return ws.send(JSON.stringify({ status: 202, uuid, jnovel: jnovelID }));

		}

	});

} catch (e: any){

	console.log(e.message);

}