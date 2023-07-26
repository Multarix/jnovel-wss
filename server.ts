import chalk from "chalk";
import cron from 'node-cron';
import { WebSocketServer } from 'ws';

import EventEmitter from "events";

import * as func from "./src/functions.js";

import { IStatus, IStoredParts, IWebSocket } from "./src/types/interfaces";
import { DataBase } from "./src/types/types";

// Set up the database first
const db: DataBase = await func.setupDatabase();

// Set up the event emitters
const jnovelEvents = new EventEmitter(); // Event emitter for the jnovel events
const allJnovelIDs: IStoredParts[] = await db.all(`SELECT * FROM parts`);


// Set up the websocket server
const port = 5683;
const wss = new WebSocketServer({ port });
console.log(`Websocket server started on port: ${chalk.cyan(port)}`, "\n");


// Set up the event listeners
for(const jnovel of allJnovelIDs) jnovelEvents.on(jnovel.id, func.newPart.bind(null, wss, db, jnovel.id));


const pingInterval = setInterval(func.ping.bind(null, wss), 30000);
wss.on("connection", (ws: IWebSocket) => {

	func.newConnection(ws);

	// Handle messages being recieved from the client
	ws.on("message", async (message) => {

		const iStatus: IStatus = func.checkAuth(ws, message.toString());
		if(iStatus.status >= 400) return;
		if(!iStatus.res) return;

		if(iStatus.res.status === 200) return;
		if(iStatus.res.status === 202){

			if(iStatus.res.jnovel){

				const jnovelID = iStatus.res.jnovel;
				const queryConnections = await db.get("SELECT * FROM connections WHERE uuid = ?", [ws.uuid]);

				// Handle existing UUID in the DB
				const args = [jnovelID, ws.uuid];
				if(!queryConnections){

					await db.run("INSERT INTO connections (jnovelID, uuid) VALUES (?, ?)", args);

				} else {

					if(queryConnections.jnovel === jnovelID) return;
					await db.run("UPDATE connections SET jnovelID = ? WHERE uuid = ?", args);

				}

				const queryParts = await db.get("SELECT * FROM parts WHERE id = ?", [jnovelID]);
				if(!queryParts){

					await db.run("INSERT INTO parts (id, parts) VALUES (?, ?)", [jnovelID, "[]"]);
					jnovelEvents.on(jnovelID, func.newPart.bind(null, wss, db, jnovelID));

				}

				ws.send(JSON.stringify({ status: 201 }));
				func.announceNewClient(ws);

			}

		}

	});


	// Handle "pongs" from the client so they don't time out
	ws.on("pong", func.heartBeat);


	// What to do when the client disconnects
	ws.on("close", async (_code) => {

		await db.run(`DELETE from connections WHERE uuid = ?`, ws.uuid);
		func.log("leave", `Client disconnected: ${chalk.magenta(ws.uuid)}`);

	});


	// Handle errors
	ws.on("error", (error: Error) => func.log("error", error.message));

});

// Web Server Close
wss.on("close", () => {

	clearInterval(pingInterval);
	db.close();

});

// Handle errors
wss.on("error", (error: Error) => func.log("error", error.message));


// Cron event for the server to check for new parts
// cron.schedule("37 0 * * * *", () => func.checkForNewParts(db, jnovelEvents));
cron.schedule("*/10 * * * * *", () => func.checkForNewParts(db, jnovelEvents));