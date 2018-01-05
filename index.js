'use strict'

require('dotenv').config()

const async = require('async')
const child = require('child_process')
const colors = require('colors')
const fs = require('fs')
const readline = require('readline')
const SDK = require('watsonworkspace-sdk')

SDK.level('error')

// the directory with script and assets is a command line argument
const dir = process.argv[2]
const script = JSON.parse(fs.readFileSync(`${__dirname}/scripts/${dir}/script.json`, 'utf8'))

const app = createApp()

// track the current line and the callback to trigger the next line
let lineCounter = 0
let callback = null

// this is important as the browser script looks for this rgb(255,255,255)
const appColor = '#FFFFFF'

// authenticate the demo app
app.authenticate()
.then(token => app.uploadPhoto(`${__dirname}/photos/App.jpg`))
.then(body => {
  console.log(`
 ~~ Watson Workspace Demo Bot ~~
 Use the following commands:
 [s] Skip the line
 [c] Copy the line to the clipboard
 [z] Back up one line
 [space] Process the line

  `)

  // read in from the terminal
  readline.emitKeypressEvents(process.stdin)
  process.stdin.setRawMode(true)
  process.stdin.on('keypress', (str, key) => {
    if ((key.ctrl && key.name === 'c')) {
      process.exit()
    } else {
      switch (key.name) {
        case 's':
          console.log('[skip]'.green)
          nextLine()
          break
        case 'z':
          console.log('[back]'.green)
          prevLine()
          break
        case 'c':
          console.log('[copy]'.green)
          copyToClipboard()
          break
        case 'e':
          console.log('[exec]'.green)
          exec()
          break
        case 'space':
          console.log('[send]'.green)
          sendLine()
          break
      }
    }
  })

  // setup the actors
  console.log(`Staging actors ...`)
  stageActors((error) => {
    // once authenticated, begin processing lines synchronously
    if (!error) {
      printQueueCard()

      async.eachSeries(script.lines, (line, cb) => {
        const delay = line.delay === undefined ? simulateDelay(line) : line.delay
        const auto = line.auto || false

        callback = cb // sendLine() will call callback to proceed to next line

        // auto messages are sent automatically based on the delay
        if (auto) {
          setTimeout(() => {
            sendLine(line)
          }, delay)
        } else {
          // otherwise the message waits for the user to send
        }
      })
    }
  })
})

// create the demo app
function createApp () {
  // use a .env file to define the APP_ID and APP_SECRET or get from script
  const app = script.app
  if (app) {
    const credentials = app.split(':')
    return new SDK(credentials[0], credentials[1])
  } else {
    return new SDK(process.env.APP_ID, process.env.APP_SECRET)
  }
}

// prints the next line and details to you (the director)
function printQueueCard () {
  const line = script.lines[lineCounter]
  const actor = line.actor || 'App'
  const delay = line.delay || 0

  // 'wait'
  let queueCard = line.auto ? 'auto '.yellow : 'wait '.red

  // 'auto 2s'
  if (line.auto) {
    queueCard += `${delay / 1000}s `
  }

  // 'auto 2s VAN'
  queueCard += `${actor.toUpperCase().magenta}`

  if (line.text) {
    let text = (typeof line.text) === 'string' ? line.text : toString(line)

    if (line.comment) {
      text = text.cyan
    }

    console.log(`${queueCard} '${text}'`)
  }

  if (line.filename) {
    console.log(`${queueCard} sending ${line.filename}`)
  }
}

// authenticate and upload photo for actors
function stageActors (callback) {
  const actors = Object.getOwnPropertyNames(script.actors)

  async.eachSeries(
    actors,
    (actor, cb) => {
      const clientSecret = script.actors[actor].split(':')
      const sdk = new SDK(clientSecret[0], clientSecret[1])

      sdk.authenticate()
      .then(token => {
        // create the SDK for this actor
        script.actors[actor] = sdk  // replace the token with the SDK
        console.log(`${actor} READY`)

        // upload the actor's photo
        if (script.uploadPhotos) {
          sdk.uploadPhoto(`${__dirname}/photos/${actor}.jpg`)
          .then(body => console.log(`${actor} photo uploaded`))
          cb()
        } else {
          cb()  // move to the next actor (the upload will occur asynchronously)
        }
      })
      .catch(error => {
        console.log(`${actor} FAILED with ${error}`)
        cb(error)
      })
    },
    error => {
      if (!error) {
        console.log(`
 ~~ Action! ~~
 `)
      }

      callback(error)
    })
}

function toString (line) {
  if ((typeof line.text) === 'string') {
    return line.text
  } else {
    return line.text.join('\n')
  }
}

// tries to simulate natural reading and typing proficiency level
function simulateDelay (line) {
  // average reading and typing words per minute
  const rate = {
    read: 200,
    write: 50
  }

  let numOfReadWords = 0

  const text = toString(line)
  if (text) {
    numOfReadWords = text.split(' ').length
  }

  // just calculate the read time since people are watching the replay
  const delay = ((numOfReadWords / rate.read) * 60 * 1000)

  return delay
}

function copyToClipboard () {
  const line = script.lines[lineCounter]
  const proc = child.spawn('pbcopy')

  proc.stdin.write(line.text)
  proc.stdin.end()

  nextLine()
}

function exec () {
  const line = script.lines[lineCounter]
  child.spawn(line.text)
  child.stderr('data', (data) => console.log(data))
}

// send either a text message or file that is the current line in queue
function sendLine () {
  const line = script.lines[lineCounter]
  const actor = script.actors[line.actor] || app
  const spaceId = script.spaces[line.space]

  if (line.text) {
    // the comment guard prevents any accidental messages from going into the space
    if (!line.comment) {
      actor.sendMessage(spaceId, {
        type: 'generic',
        version: '1',
        color: appColor,
        text: line.text
      })
      .then(message => {
        // if a focus is needed, add it to the newly created message
        const focus = line.focus
        if (focus) {
          app.addMessageFocus(message, focus.phrase, focus.lens, focus.category, [])
        }

        nextLine()
      })
      .error(error => console.log(error))
    } else {
      nextLine()
    }
  }

  if (line.filename) {
    console.log(`${line.actor} sent ${line.filename}`)
    actor.sendFile(spaceId, `${__dirname}/scripts/${dir}/${line.filename}`)
    .then(message => nextLine())
    .error(error => console.log(error))
  }
}

// go back to the previous line in sequence
function prevLine () {
  lineCounter--
  printQueueCard()
  callback()
}

// proceed to the next line in sequence
function nextLine () {
  lineCounter++

  // no more lines; end the program
  if (lineCounter === script.lines.length) {
    process.exit()
  }

  printQueueCard()
  callback()
}
