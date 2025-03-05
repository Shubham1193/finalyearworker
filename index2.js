const { createClient } = require('redis');
// const { exec } = require('child_process');
const {spawn} = require('child_process')
const fs = require('fs').promises;
const _ = require('lodash');
const os = require('os')
const cluster = require('cluster')
const crypto = require('crypto');




const client = createClient({
    url: 'rediss://red-cqailkuehbks73b22gvg:vTPutJypQOL8gt1libOtd1Xy84riwmrJ@oregon-redis.render.com:6379'
});

async function processSubmission(submission) {
    const { id, code, language, question } = JSON.parse(submission);
    try {
        const results = await runTestCases(code, language, question.testCase, question.defaultcode);
        console.log(`Finished processing the submission ${id}`);
        console.log(results);
        client.publish(id, JSON.stringify(results));
    } catch (error) {
        console.error(`Error processing submission: ${error}`);
        client.publish(id, JSON.stringify({ status: 'Error', message: error.message }));
    }
}

async function runTestCases(code, language, testCases, defaultcode) {
    const results = [];
    const completecode = code + "\n" +defaultcode.python[0]
    console.log(completecode)
    // console.log(defaultcode)

    try{
        await fs.writeFile("code.py" , completecode)
    }catch{

    }
    for (const testCase of testCases) {
        console.log(testCase)

    }

    return results;
}



async function startWorker() {
    try {
        await client.connect();
        console.log("Worker connected to Redis.");
        while (true) {
            try {
                const submission = await client.brPop("problems", 0);
                await processSubmission(submission.element); // Adjusted to access the correct element
            } catch (error) {
                console.error("Error processing submission:", error);
            }
        }
    } catch (error) {
        console.error("Failed to connect to Redis:", error);
    }
}

startWorker();

// }

