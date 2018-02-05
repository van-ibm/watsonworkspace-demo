'use strict'

require('dotenv').config()

const async = require('async')
const child = require('child_process')
const colors = require('colors')
const fs = require('fs')
const readline = require('readline')
const SDK = require('watsonworkspace-sdk')

// the directory with script and assets is a command line argument
const directory = process.argv[2]
const script = JSON.parse(fs.readFileSync(`${directory}/script.json`, 'utf8'))
substituteNames()

const botFramework = require('watsonworkspace-bot')

// start the framework with HTTPS settings since we're using OAuth
botFramework.startServer({
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem')
})

SDK.level('verbose')
botFramework.level('error')

const app = createApp()

// track the current line and the callback to trigger the next line
let lineCounter = 0
let callback = null

// this is important as the browser script looks for this rgb(255,255,255)
const appColor = '#FFFFFF'

// authenticate the demo app
app.authenticate()
.then(body => {
  printHelp()

  // read in from the terminal
  readline.emitKeypressEvents(process.stdin)
  process.stdin.setRawMode(true)
  process.stdin.on('keypress', (str, key) => {
    if ((key.ctrl && key.name === 'c')) {
      process.exit()
    } else {
      switch (key.name) {
        case 'a':
          console.log('[add]'.green)
          addActors()
          break
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
        case 'p':
          console.log('[print]'.green)
          printScript()
          break
        case 'u':
          console.log('[upload]'.green)
          uploadPhotos()
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

function addActors () {
  const roster = {}
  const spaces = script.spaces

  // iterate over all lines in the script
  script.lines.forEach(line => {
    // some lines are comments and have no actor
    if (line.actor) {
      const bot = script.actors[line.actor]

      // the user may have an actor but forgot to add the bot; error
      if (!bot) {
        console.log(`No bot information found for actor ${line.actor}`)
      } else {
        // add the actor to the roster in the correct space
        // dereference the space display name with the real id
        if (line.space) {
          const spaceId = spaces[line.space]
          const actorId = bot.id

          if (roster[spaceId] === undefined) {
            roster[spaceId] = {}
          }

          roster[spaceId][actorId] = ''
        }
      }
    }
  })

  // add the actors to the respective spaces
  const spaceIds = Object.getOwnPropertyNames(roster)
  spaceIds.forEach(spaceId => {
    const actorIds = Object.getOwnPropertyNames(roster[spaceId])

    // apps can only be added using the OAuth token - must use asUser
    const asUser = app.asUser(script.asUser)
    if (asUser) {
      asUser.getMe(['displayName'])
      .then(person => {
        console.log(`Adding actors using ${person.me.displayName}`)
        return asUser.addMember(spaceId, actorIds)
      })
      .then(message => console.log(`Added ${actorIds} to ${spaceId} ${JSON.stringify(message)}`))
      .catch(error => console.log(`Error adding ${actorIds} to ${spaceId} ${error}`))
    } else {
      printOauthHelp()
    }
  })
}

// create the demo app
function createApp () {
  const app = script.app
  const bot = botFramework.create(app.id, app.secret)

  return bot
}

// prints the next line and details to you (the director)
function printQueueCard () {
  const line = script.lines[lineCounter]
  const actor = script.actors[line.actor]
  const name = actor ? actor.name : 'App'
  const delay = line.delay || 0

  // 'wait'
  let queueCard = line.auto ? 'auto '.yellow : 'wait '.red

  // 'auto 2s'
  if (line.auto) {
    queueCard += `${delay / 1000}s `
  }

  // 'auto 2s VAN'
  queueCard += `${name.toUpperCase().magenta}`

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

function printScript () {
  script.lines.forEach(line => {
    if (line.text) {
      if (line.comment) {
        console.log(`[${line.text}]`)
      } else {
        const actor = line.actor ? script.actors[line.actor].name : ''
        console.log(`${actor.toUpperCase()}: ${line.text}`)
      }
    }
  })
}

function listActors () {
  return Object.getOwnPropertyNames(script.actors)
}

// authenticate and upload photo for actors
function stageActors (callback) {
  const actors = listActors()

  async.eachSeries(
    actors,
    (actor, cb) => {
      const id = script.actors[actor].id
      const secret = script.actors[actor].secret

      if (id && secret) {
        const sdk = new SDK(id, secret) // create the SDK for this actor

        sdk.authenticate()
        .then(token => {
          script.actors[actor].bot = sdk  // save the SDK to the actor
          console.log(`${actor} ${'READY'.green}`)
          cb()  // move to the next actor
        })
        .catch(error => {
          console.log(`${actor} ${'FAILED'.red} with ${error}`)
          cb(error)
        })
      } else {
        cb()
      }
    },
    error => {
      if (!error) {
        printOauthHelp()
        console.log(`Action!\n`)
      }

      callback(error)
    })
}

function uploadPhotos () {
  const actors = listActors()

  if (script.app.photo) {
    app.uploadPhoto(`${directory}/${script.app.photo}`)
  }

  async.eachSeries(
    actors,
    (actor, cb) => {
      const bot = script.actors[actor].bot
      const name = script.actors[actor].name
      const photo = script.actors[actor].photo

      if (photo) {
        bot.uploadPhoto(`${directory}/${photo}`)
        .then(body => console.log(`${name} photo uploaded`))
      }
      cb()
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
  if (line.text === undefined) {
    return 0
  }

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

function copyToClipboard (text) {
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

function substituteNames () {
  script.lines.forEach(line => {
    if (line.text) {
      const actors = listActors()
      actors.forEach(actor => {
        const name = script.actors[actor].name  // could be undefined
        line.text = line.text.replace(`{{${actor}}}`, name)
      })
    }
  })
}

// send either a text message or file that is the current line in queue
function sendLine () {
  const line = script.lines[lineCounter]
  const bot = line.actor ? script.actors[line.actor].bot : app
  const spaceId = script.spaces[line.space]

  if (line.text) {
    // the comment guard prevents any accidental messages from going into the space
    if (!line.comment) {
      bot.sendMessage(spaceId, {
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
    bot.sendFile(spaceId, `${directory}/${line.filename}`)
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

  // no more lines end the program
  if (lineCounter === script.lines.length) {
    process.exit()
  }

  printQueueCard()
  callback()
}

function printHelp () {
  console.log(`
~~ Watson Workspace Demo Bot ~~
Use the following commands:
[a] Add bots to spaces
[c] Copy the line to the clipboard
[s] Skip the line
[u] Upload bot photos
[z] Back up one line
[space] Process the line
`)
}

function printOauthHelp () {
  console.log(`\nAuthenticate yourself with https://localhost:3000/${script.app.id}/oauth\n`)
}
