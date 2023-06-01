const crypto = require("crypto");
const nonce = require("nonce");
const request = require("request-promise");
const querystring = require("querystring");
const cookie = require("cookie");
const express = require('express')
const app = express()
const port = process.env.PORT || 3000

const apiKey = process.env.SHOPIFY_API_KEY || "481fe6f91daa88585f6d04b2d8f34bab";
const apiSecret = process.env.SHOPIFY_API_SECRET || "481fe6f91daa88585f6d04b2d8f34bab";

const scopes = "write_products";
const forwardingAddress = "https://simple-node-tudb.onrender.com";

console.log(__dirname);

app.use('/jsfiles', express.static(__dirname + '/jsfiles'))

app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.get("/shopify", (req, res) => {
  console.log("/shopify")
  const shopName = req.query.shop;
  if (shopName) {
    // use nonce to set a parameter called state
    // the nonce is random string that would be set
    // it would be received on the request
    // the callback from shopify would echo the state
    // the two states would be compared
    // if they match, we are sure the request came from shopify
    // if they don't match, they request is being spoofed
    // this would throw an error
    const shopState = nonce();
    // shopify callback redirect
    const redirectURL = forwardingAddress + "/shopify/callback";

    // install url for app install
    const installUrl =
      "https://" +
      shopName +
      "/admin/oauth/authorize?client_id=" +
      apiKey +
      "&scope=" +
      scopes +
      "&state=" +
      shopState +
      "&redirect_uri=" +
      redirectURL;

    // in a production app, the cookie should be encrypted
    // but, for the purpose of this application, we won't do that
    res.cookie("state", shopState);
    // redirect the user to the installUrl
    console.log("InstallUrl URL"+installUrl)
    res.redirect(installUrl);
  } else {
    return res.status(400).send('Missing "Shop Name" parameter!!');
  }
});

app.get("/shopify/callback", (req, res) => {

  console.log("Shopify callback");

  const { shop, hmac, code, shopState } = req.query;
  const stateCookie = cookie.parse(req.headers.cookie).shopState;

  if (shopState !== stateCookie) {
    return res.status(400).send("request origin cannot be found");
  }

  if (shop && hmac && code) {
    const Map = Object.assign({}, req.query);
    delete Map["hmac"];
    delete Map["signature"];

    const message = querystring.stringify(Map);
    const providedHmac = Buffer.from(hmac, "utf-8");
    const generatedHash = Buffer.from(
      crypto
        .createHmac("sha256", process.env.SHOPIFY_API_SECRET)
        .update(message)
        .digest("hex"),
      "utf-8"
    );
    let hashEquals = false;
    try {
      hashEquals = crypto.timingSafeEqual(generatedHash, providedHmac);
    } catch (e) {
      hashEquals = false;
    }
    if (!hashEquals) {
      return res.status(400).send("HMAC validation failed");
    }
    const accessTokenRequestUrl =
      "https://" + shop + "/admin/oauth/access_token";
    const accessTokenPayload = {
      client_id: process.env.SHOPIFY_API_KEY,
      client_secret: process.env.SHOPIFY_API_SECRET,
      code,
    };
    request
      .post(accessTokenRequestUrl, { json: accessTokenPayload })

      .then((accessTokenResponse) => {
        const accessToken = accessTokenResponse.access_token;

        const apiRequestURL = `https:// + ${shop} + /admin/shop.json`;

        const apiRequestHeaders = {
          "X-Shopify-Access-Token": accessToken,
        };

        request
          .get(apiRequestURL, { headers: apiRequestHeaders })

          .then((apiResponse) => {
            res.end(apiResponse);
          })

          .catch((error) => {
            res.status(error.statusCode).send(error.error.error_description);
          });
      })

      .catch((error) => {
        res.status(error.statusCode).send(error.error.error_description);
      });
  } else {
    return res.status(400).send("required parameter missing");
  }
});


app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
