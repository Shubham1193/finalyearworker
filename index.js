const { createClient } = require('redis');
const { exec } = require('child_process');
const fs = require('fs').promises;
const _ = require('lodash');
const os = require('os')
const cluster = require('cluster')
const crypto = require('crypto');



// if (cluster.isPrimary) {
//     // console.log(`Number of CPUs is ${totalCPUs}`);
//     // console.log(`Primary ${process.pid} is running`);
  
//     // Fork workers.
//     for (let i = 0; i < 5; i++) {
//       cluster.fork();
//     }
  
//     cluster.on("exit", (worker, code, signal) => {
//       console.log(`worker ${worker.process.pid} died`);
//       console.log("Let's fork another worker!");
//       cluster.fork();
//     });
//   } else {
    const client = createClient({
        url: 'rediss://red-cqailkuehbks73b22gvg:vTPutJypQOL8gt1libOtd1Xy84riwmrJ@oregon-redis.render.com:6379'
      });
      
      async function processSubmission(submission) {
        const { id, code, language, question } = JSON.parse(submission);
      
        try {
          const results = await runTestCases(code, language, question.testCases, question.defaultcode);
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
      
        for (const testCase of testCases) {
          const expectedOutput = testCase.output;
          // console.log(testCase)
          const keys = Object.keys(testCase.input)
          const inputval = keys[0]
          const targetval = keys[1]
          const inputvalue = testCase.input[inputval]
          let targetvalue = testCase.input[targetval]  //[] for string and variable and . for direct propery name
          if (targetvalue == undefined){
            targetvalue = "nothing"
          }
          // console.log(inputval , targetval)
          // console.log(inputvalue , targetvalue)
    
          let fullCode = '';
      
          if (language === 'py') {
            fullCode = `${code} \n${inputval} = ${JSON.stringify(inputvalue)} \n${targetval} = ${JSON.stringify(targetvalue)} \n${defaultcode.python[0]} \nprint(outputprog)`;
        } else if (language === 'java') {
            // Define the input values dynamically
            // fullCode = `${code} \n${defaultcode.java[0]}`
        }
          function generateRandomFileName(fileExtension) {
            const randomString = crypto.randomBytes(16).toString('hex'); // Generates a random string of 32 characters
            return `${randomString}.${fileExtension}`;
           }
      
          const fileExtension = language === 'py' ? 'py' : 'java';
          const fileName = generateRandomFileName(fileExtension)
      
          try {
            await fs.writeFile(fileName, fullCode);
      
            const result = await runFileWithTimeout(fileName, language, 1000 , inputvalue , targetvalue); // 5 seconds timeout
            const trimmedResult = result.trim()
            console.log(`Actual Output: ${trimmedResult} expected ${expectedOutput}`); // Log the actual output for debugging
            console.log(`Actual Output: ${typeof trimmedResult} expected ${typeof expectedOutput}`);
            let parseOutput = JSON.parse(trimmedResult)
            if (JSON.stringify(expectedOutput) === JSON.stringify(parseOutput)) {    //why  ask someone 
              results.push({ testCase, youroutput : trimmedResult , passed: true });
            } else {
              results.push({ testCase, youroutput : trimmedResult  , passed: false });
            }
          } catch (error) {
            results.push({ testCase, error: error.message });
          } finally {
            // Attempt to delete the temporary file
            try {
              await fs.unlink(fileName);
            } catch (error) {
              console.error("Error deleting temporary file:", error);
            }
          }
        }
      
        return results;
      }
      
      async function runFileWithTimeout(fileName, language, timeoutMs) {
        return new Promise((resolve, reject) => {
          const command = language === 'py' ? `python3 ${fileName}` : `java ${fileName.replace('.java', '')}`;
          const process = exec(command, { timeout: timeoutMs }, (error, stdout, stderr) => {
            if (error) {
              if (error.killed) {
                reject(new Error('Time limit exceeded'));
              } else {
                reject(error);
              }
            } else if (stderr) {
              reject(new Error(stderr));
            } else {
              resolve(stdout);
            }
          });
      
          // Handle unexpected process termination
          process.on('exit', (code, signal) => {
            if (code !== 0) {
              if (signal === 'SIGTERM' || signal === 'SIGINT') {
                reject(new Error('Time Limit Exceeded'));
              } else {
                reject(new Error(`Failed to Pass test case`));
              }
            }
          });
        });
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

