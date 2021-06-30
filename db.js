const sqlite3  = require('sqlite3')
const { open } = require('sqlite')

const bcrypt       = require('bcrypt')
const {v4: uuidv4} = require('uuid')

const get_db = async () => {
    return await open({
        filename: process.env['SHORTS_DB'],
        driver: sqlite3.Database
    })
}

class DatabaseManager {
    constructor(db) {
        if (db === undefined)
            throw new Error('DatabaseManager must be initialized with a database!')
        this.db = db
    }

    static async create() {
        // open the database

        const db = await get_db()
        return new DatabaseManager(db)
    }

    /* --- LINK METHODS --- */

    async get_all_links() {
        return await this.db.all(`
            SELECT l.*, (
                SELECT COUNT(*) FROM Hits h WHERE h.parent=l.id
            ) as hits
            FROM Links l
            ORDER BY hits DESC
        `)
    }

    async add_link(short, original) {
        return await this.db.run(`
            INSERT INTO Links (short, original) VALUES (?,?)
        `, [short, original])
    }

    async remove_link(short) {
        const link = await this.get_link(short)
        if (!link) {
            return false
        }
        
        await this.db.run(`
            DELETE FROM Links WHERE short=?
        `, [short])
        return true
    }

    async get_link(short) {
        return await this.db.get(`
            SELECT * FROM Links WHERE short=?
        `, [short])
    }

    async write_hit(short, user_agent) {
        const timestamp = new Date().getTime() / 1000

        const parent = await this.get_link(short)

        return await this.db.run(`
            INSERT INTO Hits
                (parent, time, user_agent)
                VALUES (?,?,?)
        `, [parent.id, timestamp, user_agent])
    }

    async get_all_hits(short) {
        const link = await this.get_link(short)
        return await this.db.all(`
            SELECT * FROM Hits WHERE parent=?
                ORDER BY time DESC
        `, [link.id])
    }

    /* --- USER METHODS --- */

    async remove_session(sid) {
        await this.db.run(`
            DELETE FROM Sessions WHERE token=?
        `, [sid])
    }

    async check_session(sid) {
        const session = await this.db.get(`
            SELECT * FROM Sessions WHERE token=?
        `, [sid])

        if (!session) {
            return null
        }

        const timestamp = new Date().getTime()
        if (timestamp > session.expires) {
            return null
        }

        const user = await this.db.get(`
            SELECT * FROM Users WHERE id=?
        `, [session.user_id])

        return user
    }

    async login_user(email, password) {
        const user = await this.db.get(`
            SELECT * FROM Users WHERE email=?
        `, [email])

        if (user === undefined) {
            return null
        }

        const check = await bcrypt.compare(password, user.password)

        if (!check) {
            return null
        }

        const sid = uuidv4()
        // 2h timestamp
        const expires = new Date().getTime() + (1000 * 60 * 60 * 2)

        await this.db.run(`
            INSERT INTO Sessions(expires, user_id, token) VALUES (?,?,?)
        `, [expires, user.id, sid])

        return sid
    }

    async create_user(email, password, invite) {
        if (invite !== process.env['SHORTS_INVITE'] || process.env['SHORTS_INVITE'] === undefined) {
            return null
        }

        const pw_hash = await bcrypt.hash(password, 16)

        await this.db.run(`
            INSERT INTO Users (email, password) VALUES (?,?)
        `, [email, pw_hash])

        return await this.login_user(email, password)
    }
}

module.exports = {
    DatabaseManager
}

