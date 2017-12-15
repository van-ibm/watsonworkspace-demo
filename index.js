'use strict'

require('dotenv').config()

const async = require('async')
const fs = require('fs')
const readline = require('readline')
const SDK = require('watsonworkspace-sdk')

SDK.level('error')

// use a .env file to define the APP_ID and APP_SECRET or hard code it here
const app = new SDK(
  process.env.APP_ID,
  process.env.APP_SECRET
)

// the directory with script and assets is a command line argument
const dir = process.argv[2]
const script = JSON.parse(fs.readFileSync(`${__dirname}/scripts/${dir}/script.json`, 'utf8'))

// track the current line and the callback to trigger the next line
let lineCounter = 0
let callback = null

// this is important as the browser script looks for this rgb(255,255,255)
const appColor = '#FFFFFF'

// authenticate the demo app
app.authenticate().then(token => {
  // read in from the terminal
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  })

  // and input sent from the terminal triggers the next message to be sent
  rl.on('line', (line) => {
    sendLine()
  })

  // setup the actors
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

// prints the next line and details to you (the director)
function printQueueCard () {
  const line = script.lines[lineCounter]
  const actor = line.actor || 'App'
  const delay = line.delay || 0

  let queueCard = ''

  if (line.auto) {
    queueCard += `auto `
  } else {
    queueCard += `manual `
  }

  queueCard += `(${delay / 1000}s delay) ${actor}`

  if (line.text) {
    console.log(`${queueCard}, '${line.text}'`)
  }

  if (line.filename) {
    console.log(`${queueCard} sends filename=${line.filename}`)
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

        // upload the actor's photo
        return sdk.uploadPhoto(`${__dirname}/photos/${actor}.jpg`)
      })
      .then(body => {
        console.log(`${actor} READY`)
        cb()
      })
      .catch(error => {
        console.log(`${actor} FAILED`)
        cb(error)
      })
    },
    error => callback(error))
}

// tries to simulate natural reading and typing proficiency level
function simulateDelay (line) {
  // average reading and typing words per minute
  const rate = {
    read: 200,
    write: 50
  }

  let numOfReadWords = 0

  if (line.text) {
    numOfReadWords = line.text.split(' ').length
  }

  // just calculate the read time since people are watching the replay
  const delay = ((numOfReadWords / rate.read) * 60 * 1000)

  return delay
}

// send either a text message or file that is the current line in queue
function sendLine () {
  const line = script.lines[lineCounter]
  const actor = script.actors[line.actor] || app
  const spaceId = script.spaces[line.space]

  if (line.text) {
    // get the actor's app or use the main app if no actor is specified
    actor.sendMessage(spaceId, {
      type: 'generic',
      version: '1',
      color: appColor,
      text: line.text
    })
    .then(message => nextLine())
    .error(error => console.log(error))
  }

  if (line.filename) {
    console.log(`${line.actor} sent ${line.filename}`)
    actor.sendFile(spaceId, `${dir}/${line.filename}`)
    .then(message => nextLine())
    .error(error => console.log(error))
  }
}

// proceed to the next line in sequence
function nextLine () {
  console.log(`.`)  // just indicates the previous line was processed
  lineCounter++
  printQueueCard()
  callback()
}
