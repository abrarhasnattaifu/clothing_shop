errorHandler = (err, req, res, next) => {
    if (res.headersSent) {
        return next(err);
    }

    if (!err.status) {
        console.error(err);
    }

    res.status(err.status || 500).json({
        error: err.status ? err.message : 'Server error'
    });
}
module.exports = errorHandler;