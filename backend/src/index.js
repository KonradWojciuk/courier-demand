const { checkTrinoHealth } = require('./db/trinoClient');
const express = require('express');
const cors = require('cors');
const packetsRouter = require('./routes/packets');

const app = express();
const port = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/packets', packetsRouter);

async function startServer() {
    try {
        await checkTrinoHealth();
        console.log('Trino is healthy.');
    } catch (error) {
        console.error('Trino health check failed:', error);
        process.exit(1);
    }

    app.listen(port, () => {
        console.log(`Server is running on ${port}`);
    });
}

startServer();
