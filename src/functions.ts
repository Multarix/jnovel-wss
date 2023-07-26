import chalk from "chalk";
import { v4 as createUUID } from "uuid";

import { open } from "sqlite";
import sqlite3 from "sqlite3";

import EventEmitter from "events";
import fs from "fs";
import { Worker } from "worker_threads";

import { IConnection, IStatus, IStoredParts, IWebSocket, IWorkerData, JNovelPart } from "./types/interfaces";
import { DataBase, WebSocketServer } from "./types/types";

const debug = true;

export function log(type: string, message: any) {

	const date = new Date();
	const hours = date.getHours();
	const minutes = (date.getMinutes() < 10) ? `0${date.getMinutes()}` : date.getMinutes();
	const seconds = (date.getSeconds() < 10) ? `0${date.getSeconds()}` : date.getSeconds();

	const time = `${hours}:${minutes}:${seconds}`;

	switch(type){

		case 'info':
			console.log(`[${time}][${chalk.cyan(type.toUpperCase())}] ${chalk.white(message)}`);
			break;

		case 'warn':
			console.log(`[${time}][${chalk.yellow(type.toUpperCase())}] ${chalk.white(message)}`);
			break;

		case 'error':
			console.log(`[${time}][${chalk.red(type.toUpperCase())}] ${chalk.white(message)}`);
			break;

		case 'debug':
			if(debug) console.log(`[${time}][${chalk.magenta(type.toUpperCase())}] ${chalk.white(message)}`);
			break;

		case 'join':
			console.log(`[${time}][${chalk.green(type.toUpperCase())}] ${chalk.white(message)}`);
			break;

		case 'leave':
			console.log(`[${time}][${chalk.yellow(type.toUpperCase())}] ${chalk.white(message)}`);
			break;

		default:
			console.log(`[${time}][${chalk.blue(type.toUpperCase())}] ${chalk.white(message)}`);
			break;

	}

}


export async function setupDatabase(): Promise<DataBase> {

	const dbLoc = "./src/db.sqlite";
	const dbExists = fs.existsSync(dbLoc);
	if(!dbExists){

		fs.openSync(dbLoc, "w");

	}

	const db = await open({ filename: dbLoc, driver: sqlite3.cached.Database });

	await db.exec(`CREATE TABLE IF NOT EXISTS connections (jnovelID TEXT, uuid TEXT)`);
	await db.exec(`CREATE TABLE IF NOT EXISTS parts (id TEXT, parts TEXT)`);

	console.log("Connected to the database.");
	await db.exec(`DELETE FROM connections`); // Remove all connections on startup

	return db;

}


export async function newPart(wss: WebSocketServer, db: DataBase, jnovelID: string, parts: JNovelPart[]) {

	const allWithID = await db.all("SELECT * from connections WHERE jnovelID = ?", jnovelID);
	if(!allWithID) return;

	wss.clients.forEach((ws: IWebSocket) => {

		// These are not valid clients "yet"
		if(!ws.announced) return;
		if(!ws.uuid) return;

		if(allWithID.some((connection: IConnection) => connection.uuid === ws.uuid)) return ws.send(JSON.stringify({ status: 210, newParts: parts }));

	});

}


export function heartBeat(this: any) {

	this.isAlive = true;
	log("debug", `Client ponged: ${chalk.magenta(this.uuid)}`);

}


export function ping(wss: WebSocketServer) {

	wss.clients.forEach((ws: IWebSocket) => {

		if(ws.isAlive === false){

			log("debug", `Client timed out: ${chalk.magenta(ws.uuid)}`);
			return ws.terminate();

		}

		ws.isAlive = false;
		ws.ping();

	});

}


export function announceNewClient(ws: IWebSocket) {

	if(!ws.announced){

		log("join", `Client Connected: ${chalk.magenta(ws.uuid)}`);
		ws.announced = true;

	}

}


export function newConnection(ws: IWebSocket) {

	ws.isAlive = true;
	ws.uuid = createUUID();
	ws.announced = false;

	ws.send(JSON.stringify({ uuid: ws.uuid, establish: true }));

}


export function checkAuth(ws: IWebSocket, message: string): IStatus {

	try {

		const res = JSON.parse(message);
		if(res.uuid !== ws.uuid){

			const status = { status: 401 };
			ws.send(JSON.stringify(status));
			return status;

		}

		return { status: 200, res };

	} catch (e){

		const status = { status: 400 };
		ws.send(JSON.stringify(status));
		return status;

	}

}


export async function checkForNewParts(db: DataBase, jnovelEvents: EventEmitter) {

	log("debug", `Checking for new parts...`);

	const activeConnections: IConnection[] = await db.all("SELECT * FROM connections");
	if(!activeConnections) return;

	const uniqueIDs: Set<string> = new Set();
	for(const connection of activeConnections) uniqueIDs.add(connection.jnovelID);

	for(const id of uniqueIDs){

		log("debug", `Checking new parts for: ${chalk.magenta(id)}`);
		const jnovelParts: IStoredParts | undefined = await db.get("SELECT * FROM parts WHERE id = ?", id);
		if(!jnovelParts) continue; // Something went wrong, so we're just gonna skip it.

		const worker = new Worker("./src/fetch-response.js", { workerData: { database: jnovelParts, jnovelID: id } });
		worker.on("message", async (message: IWorkerData) => {

			log("debug", `Worker (${id}) Code: ${message.code}`);
			if(message.code === 0){

				if(!message.newParts) return;
				if(message.newParts.length >= 1) return jnovelEvents.emit(id, message.newParts);

			}

			if(message.code === 1) return log("debug", `Updated the database for: ${chalk.magenta(id)}`);

		});

		// worker.on("message", (message: JNovelPart[]) => log("debug", message));
		worker.on("error", (error) => log("error", error.message));
		worker.on("exit", (code) => log("debug", `Worker exited with code ${code}.`));

	}

}

