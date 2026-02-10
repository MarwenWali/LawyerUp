const { spawn } = require('child_process');
const path = require('path');

const AI_ENGINE_PATH = path.join(__dirname, '../ai-engine/rag_logic.py');

/**
 * Sends a prompt to the AI engine and returns the result.
 * @param {string} prompt 
 * @returns {Promise<object>}
 */
async function getAiResponse(prompt) {
    return new Promise((resolve, reject) => {
        const pythonProcess = spawn('python', [AI_ENGINE_PATH, prompt]);

        let dataString = '';
        let errorString = '';

        pythonProcess.stdout.on('data', (data) => {
            dataString += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            errorString += data.toString();
        });

        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`AI Engine exited with code ${code}: ${errorString}`));
            } else {
                try {
                    const result = JSON.parse(dataString.trim());
                    if (result.error) {
                        reject(new Error(result.error));
                    } else {
                        resolve(result);
                    }
                } catch (e) {
                    reject(new Error(`Failed to parse AI response: ${dataString}`));
                }
            }
        });
    });
}

module.exports = { getAiResponse };
