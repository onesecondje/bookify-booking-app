import { app } from './app.js';
import { config } from './config.js';

// Entry point: create the HTTP server and start listening for requests.
app.listen(config.port, () => console.log(`Server started on port ${config.port}`));
