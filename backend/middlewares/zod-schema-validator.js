const validate = (schema) => (req, res, next) => {
    const isGet = req.method === "GET";
    const source = isGet ? req.query : req.body;
    const result = schema.safeParse(source);

    if (!result.success) {
        console.log({ url: req.originalUrl, [isGet ? "query" : "body"]: source });
        console.error(result.error.flatten());
        return res.status(400).json(result.error.flatten());
    }

    if (isGet) {
        req.query = result.data;
    } else {
        req.body = result.data;
    }
    next();
};

module.exports = validate;