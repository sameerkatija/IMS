const Express = require('express');
const env = require('./config/env');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const { errorHandler, notFoundHandler } = require('./middlewares/error-handler');



const app = Express();

app.use(Express.json());
app.use(helmet());
app.use(morgan(env.nodeEnv === 'development' ? 'dev' : 'combined'));
app.use(cors({
  origin: env.clientUrl,
  credentials: true, // required so the httpOnly JWT cookie is sent/received
}));
app.use(cookieParser(env.cookieSecret)); // for signed cookies

app.use('/api', require('./routes/index'));
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(env.PORT, () => {
    console.log(`Server is running on port ${env.PORT}`);
});
