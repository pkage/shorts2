require('dotenv').config()

const express             = require('express')
const cookieParser        = require('cookie-parser')
const { DatabaseManager } = require('./db')
const bodyParser          = require('body-parser')
const flash_middleware    = require('./flash')
const useragent           = require('useragent')
const { DateTime }        = require('luxon')

// server setup
const app = express()
app.set('view engine', 'ejs')
app.use(cookieParser(process.env['SHORTS_SECRET']))
app.use('/static', express.static('static'))
app.use(flash_middleware)


app.get('/', async (req, res) => {
    const db = await DatabaseManager.create()

    let user = null
    if ('shorts_sid' in req.signedCookies) {
        const sid = req.signedCookies['shorts_sid']
        user = await db.check_session(sid)

    }

    res.render('index', {
        links: await db.get_all_links(),
        user,
        messages: req.flash.pop()
    })
})

/* --- ACCOUNT METHODS --- */

const login_required = async (req, res, next) => {
    const db = await DatabaseManager.create()

    let user = null
    if ('shorts_sid' in req.signedCookies) {
        const sid = req.signedCookies['shorts_sid']
        user = await db.check_session(sid)
    }

    if (user === null) {
        req.flash.push('sorry, you need to be logged in for that')
        res.redirect('/')
    } else {
        req.user = user
        req.db   = db

        next()
    }
}

app.post('/account/create',
    bodyParser.urlencoded({extended: true}),
    async (req, res) => {
        const db = await DatabaseManager.create()
        const sid = await db.create_user(req.body.email, req.body.password, req.body.invite)


        if (sid !== null) {
            res.cookie('shorts_sid', sid, {
                maxAge: new Date().getTime() + (1000 * 60 * 60 * 2), 
                signed: true,
                httpOnly: true,
                secret: req.secret
            })
            req.flash.push('Account created successfully.')
        } else {
            req.flash.push('You are not permitted to create an account.')
        }

        res.redirect('/')
    }
)

app.post('/account/login',
    bodyParser.urlencoded({extended: true}),
    async (req, res) => {
        const db = await DatabaseManager.create()

        const sid = await db.login_user(req.body.email, req.body.password)
        if (sid !== null) {
            res.cookie('shorts_sid', sid, {
                maxAge: new Date().getTime() + (1000 * 60 * 2), 
                signed: true,
                httpOnly: true,
                secret: req.secret
            })
        } else {
            req.flash.push('invalid username or password!')
        }

        res.redirect('/')
    }
)
app.get('/account/logout',
    login_required,
    async (req, res) => {

        if ('shorts_sid' in req.signedCookies) {
            await req.db.remove_session(req.signedCookies.shorts_sid)
            res.clearCookie('shorts_sid')

            req.flash.push('logged out successfully!')
        }

        res.redirect('/')
    }
)

/* --- SHORT LINK METHODS --- */

app.get('/x/:short', async (req, res) => {
    const db = await DatabaseManager.create()

    const short = req.params.short
    const link = await db.get_link(short)
    if (!link) {
        res.send(`no link ${short}`)
        return
    }

    const user_agent = req.headers['user-agent'] || null
    await db.write_hit(short, user_agent)

    res.redirect(link.original)
})


app.get('/info/:short',
    login_required,
    async (req, res) => {
        const short = req.params.short
        const link = await req.db.get_link(short)

        if (!link) {
            req.flash.push(`No such shortlink ${short}!`)
            res.redirect('/')
            return
        }

        const hits = (await req.db.get_all_hits(short))
            .map(h => ({
                human_date: DateTime.fromSeconds(h.time).toISO({includeOffset: false}),
                human_agent: useragent.parse(h.user_agent).toString(),

                ...h
            }))

        res.render('info', {
            link,
            hits
        })
    }
)

app.get('/delete/:short',
    login_required,
    async (req, res) => {
        const short = req.params.short
        if (await req.db.remove_link(short)) {
            req.flash.push(`Deleted shortlink "${short}" successfully.`)
        } else {
            req.flash.push(`No such shortlink "${short}"!`)
        }

        res.redirect('/')
    }
)

app.post('/submit',
    login_required,
    bodyParser.urlencoded({extended: true}),
    async (req, res) => {
        try {
            await req.db.add_link(req.body.short, req.body.url)
            req.flash.push('Created short link successfully.')
        } catch (e) {
            req.flash.push('There is already a short link with this name.')
        }

        res.redirect('/')
    }
)

app.listen(
    0+process.env['SHORTS_PORT'], 
    () => console.log(`app listening on ${process.env['SHORTS_PORT']}`)
)
