import express, { json } from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import dayjs from "dayjs";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import joi from "joi";
import { v4 as uuidV4 } from "uuid";

const userSchema = joi.object({
  name: joi.string().required().min(3).max(100),
  email: joi.string().email().required(),
  password: joi.string().required().min(6),
});

const app = express();
app.use(express.json());
app.use(cors());
dotenv.config();

const mongoClient = new MongoClient(process.env.MONGO_URI);

try {
  await mongoClient.connect();
  console.log("MongoDB Connected!");
} catch (err) {
  console.log(err);
}

const db = mongoClient.db("bookshop");
const User = db.collection("users");
const Sessoes = db.collection("sessions");
const Pedidos = db.collection("pedidos")

dotenv.config();
const port = process.env.PORT || 5000;

app.post("/sign-up", async (req, res) => {
    const user = req.body;

    try {
      const userExiste = await User.findOne({ email: user.email });
      if (userExiste) {
        return res.status(409).send("E-mail já cadastrato");
      }
  
      const { error } = userSchema.validate(user, { abortEarly: false });
  
      if (error) {
        const errors = error.details.map((detail) => detail.message);
        return res.status(400).send(errors);
      }
  
      const hashPassword = bcrypt.hashSync(user.password, 10);
      User.insertOne({ ...user, password: hashPassword });
      res.sendStatus(201);
    } catch (error) {
      console.log(error);
      res.sendStatus(500);
    }
  
    res.send();
})

app.post("/sign-in", async (req, res) => {
    const { email, password } = req.body;
  const token = uuidV4();

  try {
    const userExiste = await User.findOne({ email });
    if (!userExiste) {
      return res.sendStatus(401);
    }

    const passwordOk = bcrypt.compareSync(password, userExiste.password);
    if (!passwordOk) {
      return res.sendStatus(401);
    }

    const sessionExiste = await Sessoes.findOne({ userId: userExiste._id });
    if (!sessionExiste) {
      await Sessoes.insertOne({
        token,
        userId: userExiste._id
      })
      res.send({ user: userExiste.name, token });
      return
    }

    res.send({ user: userExiste.name, token: sessionExiste.token });
  } catch (error) {
    console.log(error);
    res.sendStatus(500);
  }
})

app.post("/pedidos", async (req, res) => {
    const { carrinho }= req.body
    const { authorization } = req.headers
    const token = authorization?.replace("Bearer ", "");
  if (!token) {
    return res.sendStatus(401);
  }

  const sessionExiste = await Sessoes.findOne({ token });
    if (sessionExiste) {
      await Pedidos.insertOne({
        userId: sessionExiste.userId,
        date: dayjs().format('DD/MM/YYYY'),
        pedido: carrinho
      })
      res.sendStatus( 200 )
    }else{
      res.status(401).send("sua sessão expirou, faça login")
    }
  
})

app.get("/meus-pedidos",  async (req, res) => {
  const { authorization } = req.headers
    const token = authorization?.replace("Bearer ", "");
  if (!token) {
    return res.sendStatus(401);
  }

   const sessionExiste = await Sessoes.findOne({ token });
    if (sessionExiste) {
      const listaPedidos= await Pedidos.find( { userId: sessionExiste.userId } ).toArray();
     return res.status(200).send(listaPedidos)
    }else{
      res.status(401).send("sua sessão expirou, faça login")
    }
  res.send(401)
})

app.listen(port, () => {
  console.log("listening on port " + port + " 🚀");
});
