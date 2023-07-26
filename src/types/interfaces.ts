import WebSocket from 'ws';

export interface IResponse {
	status?: number;
	msg?: string;
	uuid?: string;
	jnovel?: string;
	establish?: boolean;
	newParts?: any[];
}

export interface IWebSocket extends WebSocket {
	isAlive?: boolean;
	uuid?: string;
	announced?: boolean;
}

export interface IConnection {
	jnovelID: string;
	uuid: string;
}

export interface IStoredParts {
	id: string;
	parts: string;
}

export interface JNovelPart {
	id: string;
	url: string;
	title: string;
	summary: string;
	image?: string;
	date_published: string;
}

export interface JNovelResponse {
	version: string;
	title: string;
	home_page_url: string;
	description: string;
	author: {
		name: string;
	}
	items: JNovelPart[];
}

export interface IStatus {
	status: number;
	res?: IResponse;
}

export interface IWorkerData {
	code: number;
	newParts?: JNovelPart[];
	stringifiedParts?: string;
}