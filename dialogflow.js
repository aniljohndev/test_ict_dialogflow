const fetch    = require('node-fetch');
const { GoogleAuth } = require('google-auth-library');

const PROJECT_ID = process.env.DIALOGFLOW_PROJECT_ID;
const LANGUAGE   = process.env.DIALOGFLOW_LANGUAGE || 'en';

// Get access token from service account
async function getAccessToken() {
    const auth   = new GoogleAuth({
        keyFilename: './credentials.json',
        scopes:  ['https://www.googleapis.com/auth/cloud-platform'],
    });
    const client = await auth.getClient();
    const token  = await client.getAccessToken();
    return token.token;
}

// Send message to Dialogflow ES via REST API
async function detectIntent(sessionId, message) {
    const accessToken = await getAccessToken();

    const url = `https://dialogflow.googleapis.com/v2/projects/${PROJECT_ID}/agent/sessions/${sessionId}:detectIntent`;
    
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type':  'application/json',
        },
        body: JSON.stringify({
            queryInput: {
                text: {
                    text:         message,
                    languageCode: LANGUAGE,
                },
            },
        }),
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Dialogflow API error: ${err}`);
    }

    const data = await response.json();

    // Extract the fulfillment text from response
    const fulfillmentText =
        data.queryResult?.fulfillmentText ||
        data.queryResult?.fulfillmentMessages?.[0]?.text?.text?.[0] ||
        'Sorry, I did not understand that.';

    return {
        fulfillmentText,
        intent:     data.queryResult?.intent?.displayName,
        confidence: data.queryResult?.intentDetectionConfidence,
        raw:        data,
    };
}

module.exports = { detectIntent };
