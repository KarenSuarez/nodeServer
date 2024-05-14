const express = require("express");
const cors = require("cors");
const axios = require("axios");
const app = express();
const http = require("http").Server(app);
const io = require("socket.io")(http, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Access-Control-Allow-Origin"],
    credentials: true
  }
});
const moment = require("moment");
require('dotenv').config({ path: '.env' });

const PORT = process.env.PORT;
const IP_ADDRESS = process.env.IP_ADDRESS;
const SERVER_NAME = process.env.SERVER_NAME;
const MONITOR_IP = process.env.MONITOR_IP;
const MONITOR_PORT = process.env.MONITOR_PORT;
const HOST_PORT= process.env.PORT_HOST;
const HOST_IP= process.env.HOST_IP;
const SERVER_ID = process.env.SERVER_ID;

app.use(express.json());
app.use(cors());

let servers = [];
let leaderServer = null;
let healthCheckInterval = null;

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, access-control-allow-origin");
  next();
});


app.use((req, res, next) => {
  const currentDate = new Date().toISOString();
  if (res.statusCode >= 400) {
    console.error(
      `${currentDate} - Error: ${res.statusCode} ${res.statusMessage} - ${req.method} ${req.url}`
    );
    if (res.locals.errorMessage) {
      console.error(`Payload: ${JSON.stringify(res.locals.errorMessage)}`);
    }
  } else {
    console.log(`${currentDate} - ${req.method} ${req.url}`);
    io.emit("log", `${currentDate} - ${req.method} ${req.url}`);
    if (req.body) {
      console.log(`Payload: ${JSON.stringify(req.body)}`);
      io.emit("log", `Payload: ${JSON.stringify(req.body)}`);
    }
  }
  next();
});

app.get("/health", (req, res) => {
  res.status(200).send("Server is healthy");
});

app.post("/updateServerList", (req, res) => {
  const newServerList = req.body;
  servers = newServerList;

  // Encontrar al servidor líder
  leaderServer = servers.find(server => server.isLeader);

  // Detener el intervalo de health check anterior, si existe
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
  }

  // Programar el nuevo intervalo de health check al líder
  if (leaderServer) {
    const randomInterval = Math.floor(Math.random() * 29000) + 1000; // Intervalo aleatorio entre 1000ms y 30000ms
    healthCheckInterval = setInterval(checkLeaderHealth, randomInterval);
    console.log(`${moment().format("YYYY-MM-DD HH:mm:ss")} Health check al líder programado cada ${randomInterval}ms`);
  } else {
    console.log(`${moment().format("YYYY-MM-DD HH:mm:ss")} No hay servidor líder`);
  }

  console.log(`${moment().format("YYYY-MM-DD HH:mm:ss")} Updated server list:`, servers);
  res.send("Server list updated successfully");
});

const checkLeaderHealth = async () => {
  try {
    const response = await axios.get(`http://${leaderServer.ip}:${leaderServer.port}/health`);
    console.log(`${moment().format("YYYY-MM-DD HH:mm:ss")} Server líder (${leaderServer.name}) is healthy:`, response.data);
  } catch (error) {
    console.error(`${moment().format("YYYY-MM-DD HH:mm:ss")} Error checking leader health:`, error);
  }
};

let registered = false;
let leader = true;
const registerServer = async () => {
  try {
    const response = await axios.post(`http://${MONITOR_IP}:${MONITOR_PORT}/register`, {
      name: SERVER_NAME,
      ip: HOST_IP,
      port: HOST_PORT,
      id: SERVER_ID,
      isLeader: leader,

    });
    console.log("Server registered successfully in monitor:", response.data);
    registered = true;
  } catch (error) {
    console.error("Error registering server:", error.response?.data || error.message);
    registered = false;
  }
};

registerServer();



app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something went wrong!");
});

io.on("connection", (socket) => {
  console.log("Cliente conectado");
  socket.on("disconnect", () => {
    console.log("Cliente desconectado");
  });
});



http.listen(PORT, IP_ADDRESS, () => {
  console.log(`Servidor escuchando en http://${IP_ADDRESS}:${PORT}`);
});