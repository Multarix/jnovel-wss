import { isMainThread, parentPort, workerData } from "worker_threads";

import { open } from "sqlite";
import sqlite3 from "sqlite3";

import { log } from "./functions.js";
import { IStoredParts, JNovelPart, JNovelResponse } from "./types/interfaces.js";


const dbLoc = "./src/db.sqlite";
const db = await open({ filename: dbLoc, driver: sqlite3.cached.Database });
if(!db) throw new Error("Could not open the database!");

async function workerGetPart(jnovelParts: IStoredParts | undefined, id: string) {

	const revivedParts: Set<String> = (jnovelParts) ? new Set(JSON.parse(jnovelParts.parts)) : new Set();

	// check jnovel club for new parts
	const response = await _getJNovelResponse(id);
	if((response.items.length === 0)) return; // We had an error getting the response

	const newParts: JNovelPart[] = [];
	for(const item of response.items){

		if(revivedParts.has(item.title)) continue;
		newParts.push(item);
		revivedParts.add(item.title);

	}

	// Send the new parts to the main thread
	parentPort?.postMessage({ code: 0, newParts });

	// If revived parts is greater than 100, remove the oldest parts
	while(revivedParts.size > 100){

		const oldest = revivedParts.values().next().value;
		revivedParts.delete(oldest);

	}

	// Send back the stringified parts so they can be placed in the DB
	const stringifiedParts = JSON.stringify(Array.from(revivedParts));
	await db.run("UPDATE parts SET parts = ? WHERE id = ?", [stringifiedParts, id]);
	parentPort?.postMessage({ code: 1 });

}


// Return an empty JNovelResponse
const _emptyJNovelResponse = (): JNovelResponse => {

	const empty = {
		version: "",
		title: "",
		home_page_url: "",
		description: "",
		author: {
			name: ""
		},
		items: []
	};

	return empty;

};


// Get the response from J-Novel Club
const _getJNovelResponse = async (id: string): Promise<JNovelResponse> => {

	try {

		// Get the data from J-Novel Club
		const response = await fetch(`https://labs.j-novel.club/feed/user/${id}.json`);
		const text = await response.text();

		const parsed: JNovelResponse = JSON.parse(text);
		return parsed;

	} catch (e: any){

		log("error", e);
		return _emptyJNovelResponse();

	}

};


if(!isMainThread) await workerGetPart(workerData.database, workerData.jnovelID);

await db.close();