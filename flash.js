/**
 * Flash message middleware
 * @author Patrick Kage
 */
const flash_middleware = (req, res, next) => {
    /**
     * Push a message into flash
     * @param {any} msg anything JSON stringifiable for later
     */
    const push = msg => {
        let prev = []
        if ('_flash' in req.cookies) {
            prev = JSON.parse(req.cookies['_flash'])
        }

        prev.push(msg)
        res.cookie('_flash', JSON.stringify(prev))
    }

    /**
     * Peek at the flash messages without destroying
     * @returns {Array} an array of flash messages
     */
    const peek = () => {
        let prev = []
        if ('_flash' in req.cookies) {
            prev = JSON.parse(req.cookies['_flash'])
        }
        return prev
    }

    /**
     * Peek at the flash messages and destroy them
     * @returns {Array} an array of flash messages
     */
    const pop = () => {
        let prev = peek()
        if ('_flash' in req.cookies) {
            res.clearCookie('_flash')
        }

        return prev
    }

    // set the flash message handler
    req.flash = {push, peek, pop}
    next()
}

module.exports = flash_middleware
