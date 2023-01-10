require("dotenv").config();
const express = require("express");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const localStrategy = require("passport-local").Strategy;
const bcrypt = require("bcryptjs");
const DB_USER = process.env.DB_USER;
const DB_PASS = process.env.DB_PASS;
const _ = require("lodash");
const { toLower } = require("lodash");
const app = express();

// app.use(express.static(__dirname + "/public"));
// app.use(express.static(`${__dirname}/public`));
var path = require("path");
app.use(express.static(path.join(__dirname, "public")));
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs");

app.use(
  session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false,
  })
);

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect(
  "mongodb+srv://" +
    DB_USER +
    ":" +
    DB_PASS +
    "@cluster0.osynq.mongodb.net/FruitBasket?retryWrites=true&w=majority",
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
);
mongoose.set("useCreateIndex", true);
mongoose.set("useFindAndModify", false);

const sellerSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  phone: {
    type: Number,
    required: true,
  },
  role: {
    type: String,
    default: "seller",
  },
});

sellerSchema.plugin(passportLocalMongoose);

const Seller = new mongoose.model("Seller", sellerSchema);

const itemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
  },
  seller: {
    type: String,
    required: true,
  },
});

const Item = new mongoose.model("Item", itemSchema);

const buyerSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  phone: {
    type: Number,
    required: true,
  },
  items: {
    type: Array,
    default: [],
  },
  role: {
    type: String,
    default: "buyer",
  },
});

buyerSchema.plugin(passportLocalMongoose);

const Buyer = new mongoose.model("Buyer", buyerSchema);

passport.use(
  "seller-login",
  new localStrategy(
    {
      usernameField: "username",
      passwordField: "password",
      passReqToCallback: true,
    },
    function (req, username, password, done) {
      Seller.findOne(
        { username: username.toLowerCase() },
        function (err, user) {
          if (err) return done(err);
          if (!user) return done(null, false, { message: "Incorrect ID" });

          bcrypt.compare(password, user.password, function (err, res) {
            if (err) return done(err);
            if (res === false)
              return done(null, false, { message: "Incorrect password." });

            return done(null, user);
          });
        }
      );
    }
  )
);

passport.use(
  "buyer-login",
  new localStrategy(
    {
      usernameField: "username",
      passwordField: "password",
      passReqToCallback: true,
    },
    function (req, username, password, done) {
      Buyer.findOne(
        { username: username.toLowerCase() },
        function (err, foundUser) {
          if (err) return done(err);
          if (!foundUser) return done(null, false, { message: "Incorrect ID" });

          bcrypt.compare(password, foundUser.password, function (err, res) {
            if (err) return done(err);
            if (res === false)
              return done(null, false, { message: "Incorrect password." });

            return done(null, foundUser);
          });
        }
      );
    }
  )
);

passport.serializeUser(function (user, done) {
  done(null, { _id: user.id, role: user.role });
});

passport.deserializeUser(function (id, done) {
  if (id.role === "seller") {
    Seller.findById(id, function (err, user) {
      if (user) done(null, user);
      else done(err, { message: "User not found" });
    });
  } else if (id.role === "buyer") {
    Buyer.findById(id, function (err, user) {
      if (user) done(null, user);
      else done(err, { message: "User not found" });
    });
  } else {
    done({ message: "No entity found" }, null);
  }
});

function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect("/");
}

function isLoggedOut(req, res, next) {
  if (!req.isAuthenticated()) return next();
  else if (req.user.role === "seller") {
    res.redirect("/sdashboard");
  } else {
    res.redirect("/allitems");
  }
}

function isSeller(req, res, next) {
  if (req.user.role === "seller") return next();
  res.redirect("/seller");
}

function isBuyer(req, res, next) {
  if (req.user.role === "buyer") return next();
  res.redirect("/buyer");
}
function checkSeller(req) {
  if (req.isAuthenticated()) {
    return req.user.role === "seller" ? true : false;
  }
  return false;
}
function checkBuyer(req) {
  if (req.isAuthenticated()) {
    return req.user.role === "buyer" ? true : false;
  }
  return false;
}

app.get("/", isLoggedOut, function (req, res) {
  res.render("home.ejs", {
    sregister: req.query.sregister,
    bregister: req.query.bregister,
    isSeller: checkSeller(req),
    isBuyer: checkBuyer(req),
    style: "home",
  });
});

app.get("/seller", isLoggedOut, function (req, res) {
  res.render("seller.ejs", {
    exists: req.query.exists,
    error: req.query.error,
    isSeller: checkSeller(req),
    isBuyer: checkBuyer(req),
    style: "seller",
  });
});

app.post("/sregister", async (req, res) => {
  const exists = await Seller.exists({
    username: req.body.username.toLowerCase(),
  });
  if (exists) {
    res.redirect("/seller?exists=true&error=false");
    return;
  }
  bcrypt.genSalt(10, function (err, salt) {
    if (err) return next(err);
    bcrypt.hash(req.body.password, salt, function (err, hash) {
      if (err) return next(err);

      let newSeller = new Seller({
        username: req.body.username.toLowerCase(),
        password: hash,
        phone: req.body.phone,
      });

      newSeller.save();
      req.logout();
      res.redirect("/?sregister=true&bregister=false");
    });
  });
});

app.post(
  "/slogin",
  passport.authenticate("seller-login", {
    successRedirect: "/sdashboard",
    failureRedirect: "/seller?error=true&exists=false",
  })
);

app.get("/buyer", isLoggedOut, function (req, res) {
  res.render("buyer.ejs", {
    exists: req.query.exists,
    error: req.query.error,
    isSeller: checkSeller(req),
    isBuyer: checkBuyer(req),
    style: "seller",
  });
});

app.post("/bregister", async (req, res) => {
  const exists = await Buyer.exists({
    username: req.body.username.toLowerCase(),
  });
  if (exists) {
    res.redirect("/buyer?exists=true&error=false");
    return;
  }
  bcrypt.genSalt(10, function (err, salt) {
    if (err) return next(err);
    bcrypt.hash(req.body.password, salt, function (err, hash) {
      if (err) return next(err);

      let newBuyer = new Buyer({
        username: req.body.username.toLowerCase(),
        password: hash,
        phone: req.body.phone,
      });

      newBuyer.save();
      req.logout();
      res.redirect("/?bregister=true&sregister=false");
    });
  });
});

app.post(
  "/blogin",
  passport.authenticate("buyer-login", {
    successRedirect: "/",
    failureRedirect: "/buyer?error=true&exists=false",
  })
);

app.get("/sdashboard", isLoggedIn, isSeller, function (req, res) {
  Seller.findOne(
    { username: req.user.username.toLowerCase() },
    function (err, foundUser) {
      if (!err) {
        Item.find(
          { seller: req.user.username.toLowerCase() },
          function (error, foundItems) {
            if (!error) {
              res.render("sdashboard.ejs", {
                name: _.capitalize(foundUser.username),
                items: foundItems,
                isSeller: checkSeller(req),
                isBuyer: checkBuyer(req),
                style: "sdashboard",
              });
            } else {
              console.log(error);
            }
          }
        );
      } else {
        console.log("error");
      }
    }
  );
});

app.get("/allitems", function (req, res) {
  Item.find({}, function (err, foundItems) {
    if (!err) {
      let name = "";
      if (req.isAuthenticated()) {
        name = req.user.username;
      }
      res.render("allItems.ejs", {
        items: foundItems,
        username: _.capitalize(name),
        isSeller: checkSeller(req),
        isBuyer: checkBuyer(req),
        added: req.query.added,
        style: "allitems",
      });
    } else {
      console.log(err);
    }
  });
});

app.post("/addFruitsForm", function (req, res) {
  const newItem = new Item({
    name: req.body.fruitName,
    price: req.body.price,
    quantity: req.body.quantity,
    seller: req.body.seller.toLowerCase(),
  });
  newItem.save();
  res.redirect("/sdashboard");
});

app.post("/addedFruitsForm/:id", function (req, res) {
  if (req.body.submitBtn === "update") {
    Item.findOneAndUpdate(
      { _id: req.params.id },
      { $set: { price: req.body.updatedPrice } },
      function (err) {
        if (err) {
          console.log(err);
        } else {
          res.redirect("/sdashboard");
        }
      }
    );
  } else if (req.body.submitBtn === "delete") {
    Item.findOneAndRemove({ _id: req.params.id }, function (err) {
      if (err) {
        console.log(err);
      } else {
        res.redirect("/sdashboard");
      }
    });
  } else {
    res.send("Error");
  }
});

app.get("/addtocart/:id", isLoggedIn, isBuyer, function (req, res) {
  Buyer.updateOne(
    { username: req.user.username.toLowerCase() },
    { $push: { items: req.params.id } },
    function (err, added) {
      if (err || !added) {
        console.log(err);
      } else {
        res.redirect("/allitems?added=true");
      }
    }
  );
});

app.get("/bcart", isLoggedIn, isBuyer, function (req, res) {
  Buyer.find(
    { username: req.user.username.toLowerCase() },
    function (err, foundUser) {
      if (!err) {
        let items = foundUser[0].items;
        Item.find({}, function (error, foundItems) {
          let arr = [];
          if (!error) {
            foundItems.map((item) => {
              items.map((id) => {
                if (id == item._id) {
                  arr.push(item);
                }
              });
            });
            res.render("bcart.ejs", {
              items: arr,
              isSeller: checkSeller(req),
              isBuyer: checkBuyer(req),
              style: "bcart",
            });
          } else {
            console.log(error);
          }
        });
      } else {
        console.log(err);
      }
    }
  );
});

app.get("/remove/:id", isLoggedIn, isBuyer, function (req, res) {
  Buyer.updateOne(
    { username: req.user.username.toLowerCase() },
    { $pull: { items: req.params.id } },
    function (err, removed) {
      if (err || !removed) {
        console.log(err);
      } else {
        res.redirect("/bcart");
      }
    }
  );
});

app.get("/logout", function (req, res) {
  req.logout();
  res.redirect("/");
});

let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
}
app.listen(port, function (req, res) {
  console.log("Server started at port " + port);
});
