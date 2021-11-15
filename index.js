const express = require('express')
const app = express()
require('dotenv').config()
const admin = require("firebase-admin");
const cors = require('cors')
const stripe = require('stripe')(process.env.STRIPE_SECRET)
const ObjectId = require('mongodb').ObjectId
const port = process.env.PORT || 5000 ;
app.get('/', (req, res) => {
  res.send('Hello doctors portal!')
})



const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});



const { MongoClient } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.bwbvx.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
//midlewate
app.use(cors())
app.use(express.json())

async function varifyToken (req,res,next) {
  if(req.headers?.authorization?.startsWith('Bearer ')){
    const token = req.headers.authorization.split(' ')[1];
    try{
      const decodedUser = await admin.auth().verifyIdToken(token)
      req.decodedEmail = decodedUser.email
    }catch{

    }
  }
  next()

}
async function run() {
    try {
      await client.connect();
      console.log("database connected successfully")
      const database = client.db("doctors-portal");
      const appointmentCollection = database.collection('appointments')
      const usersCollection = database.collection('users')

      app.post('/appointments' , async(req, res) => {
          const appointment = req.body 
          const result = await appointmentCollection.insertOne(appointment)
          res.json(result)
      })

      app.get('/appointments' , async(req , res) => {
        const email = req.query.email
        const date = new Date(req.query.date).toDateString()
        const query = {patientEmail : email , date:date}
        console.log(date)
        const cursor = appointmentCollection.find(query)
        const result = await cursor.toArray()
        res.json(result)
      })

      app.post('/users' , async(req, res) => {
        const user = req.body
        const result = await usersCollection.insertOne(user)
        res.json(result)
        console.log(result)
      })

      app.put('/users' , async(req, res) => {
        const user = req.body
        const filter = {email : user.email}
        const options = { upsert: true };
        const updateDoc = {$set:user}
        const result = await usersCollection.updateOne(filter,updateDoc , options)
        res.json(result)
      })

      app.put("/users/admin" , varifyToken , async(req, res) => {
        const user = req.body;
        const requester = req.decodedEmail
        if(requester){
          const requesterAccount = await usersCollection.findOne({email : requester})
          if(requesterAccount.role === 'admin'){
            console.log(user , req.decodedEmail)
            const filter = {email : user.email}
            const updateDoc = {$set:{role:"admin"}};
            const result = await usersCollection.updateOne(filter,updateDoc)
            res.json(result)
          }
        }else{
          res.status(401)
        }
       
        
      })

      app.get('/users/:email' , async(req, res) => {
        const email = req.params.email
        const query = {email : email}
        const user = await usersCollection.findOne(query)
        let isAdmin = false
        if(user?.role === 'admin'){
          isAdmin = true
        }
        res.json({admin:isAdmin})
      })

      app.get('/appointment/:id' , async(req,res) => {
        const id = req.params.id
        const query = {_id : ObjectId(id)}
        const result = await appointmentCollection.findOne(query)
        res.json(result)
      })

      app.put('appointment/:id' , async(req, res) => {
        const id = req.params.id
        const payment = req.body;
        const filter = {_id:ObjectId(id)};
        const updatedDoc  = {$set : {
          payment:payment
        }}
        const result = await appointmentCollection.updateOne(filter,updatedDoc)
        res.json(result)
      })
      //const haiku = database.collection("haiku");
      // create a document to insert
      app.post('/create-payment-intent' , async(req,res) => {
        const paymentInfo = req.body;
        const amount = paymentInfo.price * 100;
        const paymentIntent  = await stripe.paymentIntents.create({
          amount: amount,
          currency: "usd",
          payment_method_types: ['card'],
        })
        res.json({
           clientSecret: paymentIntent.client_secret,
        })
      })
    } finally {
      
    }
  }
  run().catch(console.dir);
app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})