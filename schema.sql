DROP TABLE IF EXISTS Links;
DROP TABLE IF EXISTS Hits;
DROP TABLE IF EXISTS Users;
DROP TABLE IF EXISTS Sessions;

-- Link-shortening functionality

CREATE TABLE Links (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    short       TEXT,
    original    TEXT,
    UNIQUE (short)
);

CREATE TABLE Hits (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    time        INTEGER,
    user_agent  TEXT,
    parent      INTEGER,
    FOREIGN KEY (parent) REFERENCES Links (id)
        ON DELETE CASCADE ON UPDATE NO ACTION
);

-- Logins

CREATE TABLE Users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    email       TEXT NOT NULL,
    password    TEXT NOT NULL,
    UNIQUE(email)
);

CREATE TABLE Sessions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    expires     INTEGER NOT NULL,
    token       TEXT NOT NULL,
    user_id     INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES Users (id)
        ON DELETE CASCADE ON UPDATE NO ACTION
);
