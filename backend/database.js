const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

// Initialize SQLite database
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, 'database.sqlite'),
    logging: false
});

// Define User model
const User = sequelize.define('User', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    phone: {
        type: DataTypes.STRING,
        allowNull: true
    },
    role: {
        type: DataTypes.ENUM('citizen', 'lawyer', 'admin'),
        defaultValue: 'citizen'
    },
    // Lawyer specific fields
    specialization: {
        type: DataTypes.STRING,
        allowNull: true
    },
    experience: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    fees: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    rating: {
        type: DataTypes.FLOAT,
        defaultValue: 0
    },
    diplomaUrl: {
        type: DataTypes.STRING,
        allowNull: true
    },
    bio: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    // Status fields
    status: {
        type: DataTypes.ENUM('pending', 'approved', 'rejected', 'active'),
        defaultValue: 'active' // 'active' for citizens, 'pending' for lawyers initially
    },
    submissionDate: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    approvalDate: {
        type: DataTypes.DATE,
        allowNull: true
    },
    rejectionDate: {
        type: DataTypes.DATE,
        allowNull: true
    }
});

module.exports = { sequelize, User };
