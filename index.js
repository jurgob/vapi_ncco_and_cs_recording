/**
nexmo context: 
you can find this as the second parameter of rtcEvent funciton or as part or the request in req.nexmo in every request received by the handler 
you specify in the route function.

it contains the following: 
const {
        generateBEToken,
        generateUserToken,
        logger,
        csClient,
        storageClient
} = nexmo;

- generateBEToken, generateUserToken,// those methods can generate a valid token for application
- csClient: this is just a wrapper on https://github.com/axios/axios who is already authenticated as a nexmo application and 
    is gonna already log any request/response you do on conversation api. 
    Here is the api spec: https://jurgob.github.io/conversation-service-docs/#/openapiuiv3
- logger: this is an integrated logger, basically a bunyan instance
- storageClient: this is a simple key/value inmemory-storage client based on redis

*/

const axios = require('axios');

const DATACENTER = `https://api.nexmo.com` 


const voiceEvent = async (req, res, next) => {
    const { logger, csClient } = req.nexmo;

    try { 
        
        res.json({})

    } catch (err) {
        
        logger.error("Error on voiceEvent function")
    }
    
}

const voiceAnswer = async (req, res, next) => {
    const { logger, csClient,storageClient } = req.nexmo;
    logger.info("req", { req_body   : req.body})
    const legId = req.body.uuid
    await storageClient.set('letID2Record', legId)
    try {
        let recordRes = await csClient({
            url: `${DATACENTER}/v0.3/legs/${legId}/recording`,
            method: "post",
            data: {
                "split": false,
                "streamed": true,
                "beep": true,
                "public": true,
                "format": "mp3"
            }
        })
        // logger.error(`* type: ${type}, line 3`)
        let record_id = recordRes.data.id

        return res.json([
            {
                "action": "talk",
                "text": `Hello , This Is an NCCO Demo, now we are gonna record you`
            },
            {
                "action": "conversation",
                "name": "nexmo-conference-standard",
            }
            // {
            //     "action": "talk",
            //     text: `Your number is ${req.body.from.split("").join(" ")}`
            // },
            // {
            //     "action": "talk",
            //     text: `And you are colling the number ${req.body.to.split("").join(" ")}`
            // },
            // {
            //     "action": "talk",
            //     text: `Have a nice day, now we are gonna hangup`
            // }
        ])

    } catch (err) {

        logger.error("Error on voiceAnswer function", {err})
    }

}

const rtcEvent = async (event, { logger, csClient,storageClient,generateBEToken }) => {
    let type;
    try {
        type = event.type
        
        if(type == 'audio:say:done'){
            logger.info(`* type: ${type}, line 1`)
            const legId = await storageClient.get('letID2Record')
            logger.info(`* type: ${type}, line 2`)
            
            await sleep(4000)
            logger.info(`* type: ${type}, line 4`)
            
            await csClient({
                url: `${DATACENTER}/v0.3/legs/${legId}/recording`,
                method: "delete"
            })
            logger.info(`* type: ${type}, line 5`)
        } else if (type == 'audio:record:done') { /* the text to speech is finished */
            const recordingsString = await storageClient.get('recordings')
            const recordings = recordingsString ? JSON.parse(recordingsString) : []
            const downloadRecordingsCommand = `curl --location --request GET 'https://api-us.nexmo.com/v1/files/3afa9c49-4cd7-48f5-9180-40163cdc2b0c' \
            --header 'Authorization: Bearer ${generateBEToken()}' --output recording.mp3`
            event.downloadRecordingsCommand = downloadRecordingsCommand;
            recordings.push(event)

            await storageClient.set('recordings', JSON.stringify(recordings))
        }


    }catch(err){
        logger.error({err}, `Error on rtcEvent function on event ${type}`)
    }

}

const route =  async (app) => {
    app.get('/recordings', async (req, res) => {

        const {
            logger,
            storageClient
        } = req.nexmo;
        const recordingsString = await storageClient.get('recordings')
        const recordings = recordingsString ? JSON.parse(recordingsString) : []

        logger.info(`Hello Request HTTP `)

        res.json({
            recordings
        })
    })
    app.get('/token', async (req, res) => {
        const {
            generateBEToken
        } = req.nexmo;
        res.json({
            token: generateBEToken()
        })
        // const downloadId = `3afa9c49-4cd7-48f5-9180-40163cdc2b0c`
        //axios
        // res.download(`https://api-us.nexmo.com/v1/files/${downloadId}`)
    })
}

module.exports = {
    voiceEvent,
    rtcEvent,
    voiceAnswer,
    route
}