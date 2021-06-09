const express = require("express");
const bodyParser = require("body-parser");
const mongoose=require("mongoose");
const _ = require('lodash');
const scale = require('scale-number-range');
const md5=require("md5");
const data=require('./data.json');
const brain =require("brain.js");
const dotenv=require('dotenv').config();
const app = express();
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));
mongoose.connect(process.env.MONGODB_URI, {useNewUrlParser: true}).then(() => {
	console.log("Connected to Database");
	}).catch((err) => {
		console.log("Not Connected to Database ERROR! ");
	});
mongoose.set("useCreateIndex",true);
mongoose.set('useFindAndModify', false);
const usersSchema= {
    firstName: String,
    lastName: String,
    age:Number,
    sex:String,
    email:String,
    pregnancies:Number,
    glucose:Number,
    bloodPressure:Number,
    bmi:Number,
    password:String
};
const User = mongoose.model("User", usersSchema);

const network=new brain.recurrent.RNN();;

const trainingData=data.map(item=>({
	input:[
		scale((item.pregnancies),0,10,0,1),
		scale((item.glucose),0,600,0,1),
		scale((item.bloodPressure),0,300,0,1),
		scale((item.bmi),0,100,0,1),
		scale((item.age),0,100,0,1)],
	output:[
		item.diabetes
	]
}));

network.train(trainingData);

app.get("/",(req,res)=>{
    res.render("main");
});

app.get("/signup",(req,res)=>{
    res.render("signup",{error:""});
});

app.post("/signup",(req,res)=>
{
	const email=req.body.email;
	User.findOne({email:email},function(err,foundUser){
		if(err)
		{
			res.render("signup",{error:"Something has happened. Please try again later!"});
		}
		else{
			if(foundUser)
			{
				res.render("signup",{errnodeor:"Account with this mailId already created. Try Logging in"});
			}
			else{
				const user=new User({
					firstName:req.body.fname,
					lastName:req.body.lname,
					email:req.body.email,
					password:md5(req.body.password),
                    age:null,
                    sex:req.body.gender,
                    pregnancies:0,
                    glucose:null,
                    bloodPressure:null,
                    bmi:null
				});
				user.save(function(err){
					if(!err){
						User.findOne({email:req.body.email},function(err,foundUser){
							const url ="/"+foundUser._id+"/checker";
							res.redirect(url);
						});
					}
					else
					{
						res.redirect("/signin");
					}
				});
			}
		}
	});
});

app.get("/signin",(req,res)=>{
    res.render("signin",{error:""});
});

app.post('/signin',(req,res)=>{
    User.findOne({email:req.body.email},function(err,foundUser){
		if(err)
		{
			res.render("signin",{error:"Something has happened. Please try again later!"});
		}
		else
		{
			if(foundUser)
			{
				if(foundUser.password===md5(req.body.password))
				{
					//PASSWORD MATCHED
					const link="/"+foundUser._id+"/checker";
					res.redirect(link);
				}
				else{
					res.render("signin",{error:"Wrong Password"});
				}
			}
			else
			{
                res.render("signin",{error:"User Not Found!"});
			}
		}
	});
});

app.get("/:id/checker",(req,res)=>{
    User.findOne({_id:req.params.id},function(err,foundUser){
        if(err)
        {
            res.render("signin",{error:"Something has happened. Please try again later!"});
        }
        else{
            if(foundUser)
            {
                res.render("checker",{name:foundUser.firstName,gender:foundUser.sex,id:foundUser.id});
            }
            else
			{
                res.render("signup",{error:"Invalid Account Signup to create an account"});
            }
        }
    });
});

app.post("/:id/checker",async(req,res)=>{
await User.findOneAndUpdate({_id:req.params.id},
	{
		pregnancies:(req.body.pregnancies)?req.body.pregnancies:0,
		age:req.body.age,
		glucose:req.body.glucose,
		bloodPressure:req.body.bp,
		bmi:req.body.bmi
	});
	const output=network.run([
		scale(parseInt(req.body.pregnancies),0,10,0,1),
		scale(parseInt(req.body.glucose),0,600,0,1),
		scale(parseInt(req.body.bloodPressure),0,300,0,1),
		scale(parseInt(req.body.bmi),0,100,0,1),
		scale(parseInt(req.body.age),0,100,0,1)]);
	 	//console.log(output[0]);
		res.redirect("/"+req.params.id+"/result/"+output[0]);
})


app.get("/:id/result/:ans",(req,res)=>{
	User.findOne({_id:req.params.id},function(err,foundUser){
		if(err)
		{
			console.log(err);
		}
		else
		{
			if(foundUser)
			{
				res.render("result",{firstName:foundUser.firstName,ans:req.params.ans});
			}
			else
			{
				console.log("User not found!");
			}
		}
	});
});



port=process.env.PORT;
if(!port)
{
	port=3000;
}
app.listen(port, function() {
  console.log("Server started on port 3000");
});
