# IBM Watson Workspace Demo Assistant

During a live demo or screen recording, multiple actors are needed to send
messages or files into spaces to simulate real activity. To make the process more
scripted, the demo assistant app uses "bots" to portray real persons.

Bots (and apps) have specific limitations in Workspace. For example, a message posted by
a bot will have a small vertical line to the left of the message text.  The bot's profile
photo will be rounded squares rather than circular like users. Both ensure that a bot does not appear
to be a real person.

To work with this design while also creating something that is programmed and repeatable,
the demo assistance app has the following approach.
- A bot should be registered in Watson Work Services for each "person".
The application's name should be the corresponding person, "Simone Dray" for example.
- A photo with circular vignette and green presence indicator should be created.
- For demos and recordings, a [browser script](userscript.js) is used to remove the vertical app indicator.
- A repeatable script is created with messages or file uploads corresponding to the "person".

![Screenshot](screenshot.gif)

## Quick Start
1. Install [Node.js](https://nodejs.org).
2. Run `npm install`.
3. Run `node index.js /folder/containing/script`.

## Installation

Use the `npm install` terminal command inside the application directory.

## Places, people!

A script is defined as `script.json` in a directory of your choice. Think of it just like a script used in acting. The script follows the format below.

```javascript
{
  "app": {
    "id": "4fa59c79-8543-....-b576-b2c9dd39e95b",
    "secret": "2Izluyqyx2...6kpklQZRfwi_JUr",
    "photo": "App.jpg"
  },
  "asUser": "533cdda8-75a4-....-8a88-260fcc4ed68f",
  "actors": {
    "Product Mgr": {
      "name": "Ted Amado",
      "id": "de853443-641c-....-84d2-51c96a843d3a",
      "secret": "r0otpdVpCX...VpZ6E8oYTfe",
      "photo": "../photos/Ted.jpg"
    },
    "Dev Lead": {
      "name": "Simone Dray",
      "id": "ea4f07ad-df93-....-96c1-274d8c04138a",
      "secret": "t8zgfwnfc...woPbM1wrNDM9p",
      "photo": "../photos/Simone.jpg"
    }
  },
  "spaces": {
    "resolution": "5a53c107e...b971c50950a8"
  },
  "lines": [
    {
      "comment": true,
      "text": "Greenwell Resolution Room"
    },
    {
      "actor": "Product Mgr",
      "space": "resolution",
      "text": "Who is an expert on Greenwell Phone?"
    },
    {
      "actor": "Product Mgr",
      "space": "resolution",
      "text": "Thanks for joining, *{{Dev Lead}}*; I have a few questions related to the Greenwell Phone's camera."
    },
    {
      "actor": "Dev Lead",
      "space": "resolution",
      "text": "Hi, *{{Product Mgr}}*. I lead the dev team responsible for the Greenwell phone. How can I help?"
    }
  ]
}
```

The `actors` property declares roles such as *Dev Lead*. Each role has the following properties.
- `name` the display name of the actor
- `id` the App ID of the corresponding bot
- `secret` the App secret of the corresponding bot
- `photo` a relative file path with a photo of the actor (bot)

The `spaces` property similarly declares aliases for spaces such as *resolution* with the corresponding spaceId.

The `lines` array declares the messages that will be sent sequentially into a space by a given actor. If the `actor` property is omitted, the message is sent as the app defined by the `app` property.

When using the curly braces, `{{Product Mgr}}`, the corresponding actor's name will be substituted for the given role.

## Setup

1. Create an app on the [Your Apps](https://developer.watsonwork.ibm.com/apps) page. An app should be created for each actor.
2. Create one more app that acts as your demo assistant.
2. Add the respective app IDs and secrets to the corresponding `app` and `actors` entries in the script.

## Sending Messages
There are two ways to send messages:
- Manually
- Automatically

Lines that omit the `auto` property or are set to `auto: false` will be manually sent into a space. To trigger the line to be sent, the user hits the `enter` key on the terminal. Doing so sends the message and queues the next line.

Automatic lines `auto: true` will be sent automatically by the application. This is useful when you have a group of interactions that will occur without your intervention. To make the dialog appear natural, you can specify a `delay`.  For example, `delay: 5000` would specify a 5 second delay from completion of the previous message. If `delay` is omitted, an average reading level of 200 words per minute will be used.

Messages come in two categories:
- Text
- Files

If the `text` property is used, a text message will be sent. You can use Markdown as part of the message text.

If the `filename` property is set to a filename, the file will be uploaded into the space.

## Starting the App
From the terminal run `node index.js <directory>`.

For example
`node index.js /Users/vanstaub/Desktop/marketing-video`

All assets such as the `script.json` and files should reside in the directory. The `script.json` will be automatically processed when the application starts.

Additionally, any actors will be authenticated.

After all actors are authenticated, you can use the `enter` key on the terminal to send manual messages or wait for automatic messages to queue.

## Controlling the App
Use the following commands to control how lines are processed:
- `c` Copy the line to the clipboard
- `s` Skip the line
- `u` Upload bot photos
- `z` Back up one line
- `space` Process the line

## Stopping or Restarting

After any updates to `script.json`, use `ctrl+c` to stop the app and restart it with the `node index.js <directory>` command.

## Browser Script

If demoing Workspace from the browser, you can use the [userscript.js](userscript.js)
to remove the vertical indicator. Use either [Tampermonkey](https://chrome.google.com/webstore/detail/tampermonkey) or [Greasemonkey](https://addons.mozilla.org/en-US/firefox/addon/greasemonkey/) and copy the `userscript.js`
script located in this project.
