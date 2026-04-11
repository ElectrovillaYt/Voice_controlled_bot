const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const cors = require('cors');
require('dotenv').config()

const port = process.env.PORT || 5000;
const app = express();
app.use(cors());
const server = http.createServer(app);

const wss = new WebSocket.Server({ server });
const clients = new Set();

app.use(express.static(path.join(__dirname, 'public')));

wss.on('connection', (ws, req, res) => {
    const token = req?.headers['x-device-token'];
    if (process.env.DEVICE_TOKEN !== token) {
        ws.close(1008, "Unauthorized");
        return;
    }
    console.log('Websocket Client connected');
    clients.add(ws);

    ws.on('close', () => {
        clients.delete(ws);
        console.log('Websocket Client disconnected');
    });
});


const sendToESP = (data) => {
    const message = JSON.stringify(data);
    clients.forEach((client) => {
        if (client.readyState === 1) { // OPEN
            client.send(message);
        }
    });
}

app.get("/", async (req, res) => {
    res.sendFile(path.join(__dirname, '/index.html'));
});

app.get("/motor", async (req, res) => {
    const data = req.query;
    if (!data) return res.json({ message: "null or invalid input received!", status: 400 });
    const cmd = {
        alias: "direction",
        cmd: data?.dir
    }
    sendToESP(cmd);
    return res.json({ message: "OK", status: 200 })
});


app.get("/speed", async (req, res) => {
    const data = req.query;
    if (!data) return res.json({ message: "null or invalid input received!", status: 400 });
    const cmd = {
        alias: "speed",
        cmd: data?.s
    }
    sendToESP(cmd);
    return res.json({ message: "OK", status: 200 })
});

app.get("/servo", async (req, res) => {
    const data = req.query;
    if (!data) return res.json({ message: "null or invalid input received!", status: 400 });
    const cmd = {
        alias: "servo",
        cmd: { servo: data?.s, angle: data?.a }
    }
    sendToESP(cmd);
    return res.json({ message: "OK", status: 200 })
});

server.listen(port, '0.0.0.0', () => {
    console.log('Server running at port:', port);
});