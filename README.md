## Trackmania-Bot
A Discord Chat Bot that executes API requests to Nadeo and trackmania.exchange to retrieve information pertaining to the game Trackmania, by Ubisoft.

I already have a bot running with this project that you can add to your discord server with this [`link`](https://discord.com/api/oauth2/authorize?client_id=1175476301105217617&permissions=10240&scope=applications.commands+bot)

If you wish to create your own bot using this code, make sure to follow the tutorial [`Discord`](https://discord.com/developers/docs/getting-started) provided on how to achieve this, and when you use the URL Generator for the bot, select the `bot` and `applications.commands` scopes, with the `send messages` and `manage messages` bot permissions.

## Building
To start, download or clone the project. Before running anything, rename the `.env.sample` to `.env`, and fill out the file with the necessary information, which are for: 
- [`Discord`](https://discord.com/developers/docs/getting-started) (which will be a little further down from Step 2: Running Your App)
- [`Nadeo API Auth`](https://webservices.openplanet.dev/auth)
- [`Trackmania OAuth API`](https://webservices.openplanet.dev/oauth/auth)
- The port that you wish to portforward.

Now, open the terminal and navigate to the file directory that this project is located in and run the following commands:
```
npm install
npm register
npm start
```

All that's left to do is port-forward the port you specified in the .env file. An easy way to do this is by downloading [`ngrok`](https://ngrok.com/) and have it start listening to the port that you specified, then copy and pasting the forwared link into the interactions endpoint url textbox in the general information tab of the bot.

Make sure to append '/interactions' to the end of the forwarded link in the interactions endpoint url textbox.
