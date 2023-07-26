import sqlite3 from "sqlite3";
import { Database } from "sqlite";

import WebSocket from "ws";
import { IncomingMessage } from "http";

export type DataBase = Database<sqlite3.Database, sqlite3.Statement>
export type WebSocketServer = WebSocket.Server<typeof WebSocket, typeof IncomingMessage>