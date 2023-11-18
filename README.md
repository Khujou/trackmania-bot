Before anything, rename the .env.sample file provided to .env and enter in the information from the discord bot you want to use this code with. 

To install packages needed ->
```
node 
```

Once that's done, ->
```
npm run register
```

To run the bot, I personally use ngrok to tunnel HTTP traffic. Install [`ngrok`](https://ngrok.com/) and have it start listening to port 3000 ->
```
ngrok http 3000
```

Once you've done all that, you can ->
```
node app.js
```

Copy the forwarded address from ngrok into the discord bot's interactions endpoint url, appending '/interactions' to the end of the url, and the commands should start working.