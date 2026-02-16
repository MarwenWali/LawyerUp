/**
 * Knex migration: create full schema for LawyerUp (simplified from provided SQL)
 * Note: This migration attempts to create tables in an order honoring FK constraints.
 */

exports.up = async function (knex) {
    // Create tables only if they do not already exist
    if (!(await knex.schema.hasTable('admins'))) {
        await knex.schema.createTable('admins', (t) => {
            t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
            t.string('name').notNullable();
            t.string('email').notNullable().unique();
            t.string('password_hash').notNullable();
            t.string('role').defaultTo('admin');
            t.timestamp('created_at').defaultTo(knex.fn.now());
            t.timestamp('updated_at').defaultTo(knex.fn.now());
            t.timestamp('last_login');
            t.boolean('is_active').defaultTo(true);
        });
    }

    if (!(await knex.schema.hasTable('citizens'))) {
        await knex.schema.createTable('citizens', (t) => {
            t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
            t.string('name').notNullable();
            t.string('email').notNullable().unique();
            t.string('password_hash').notNullable();
            t.string('phone');
            t.timestamp('created_at').defaultTo(knex.fn.now());
            t.timestamp('updated_at').defaultTo(knex.fn.now());
            t.boolean('is_active').defaultTo(true);
        });
    }

    if (!(await knex.schema.hasTable('lawyers'))) {
        await knex.schema.createTable('lawyers', (t) => {
            t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
            t.string('name').notNullable();
            t.string('email').notNullable().unique();
            t.string('password_hash').notNullable();
            t.string('phone');
            t.specificType('specialization', 'text[]').notNullable();
            t.integer('experience_years');
            t.string('status').defaultTo('pending');
            t.decimal('fees');
            t.decimal('rating').defaultTo(0.0);
            t.integer('total_reviews').defaultTo(0);
            t.string('license_number');
            t.string('bar_association');
            t.text('bio');
            t.string('profile_image_url');
            t.timestamp('created_at').defaultTo(knex.fn.now());
            t.timestamp('updated_at').defaultTo(knex.fn.now());
            t.timestamp('approved_at');
            t.uuid('approved_by');
            t.boolean('is_active').defaultTo(true);
            t.foreign('approved_by').references('admins.id');
        });
    }

    if (!(await knex.schema.hasTable('consultations'))) {
        await knex.schema.createTable('consultations', (t) => {
            t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
            t.uuid('citizen_id').notNullable().references('id').inTable('citizens').onDelete('CASCADE');
            t.uuid('lawyer_id').notNullable().references('id').inTable('lawyers').onDelete('CASCADE');
            t.string('consultation_type').defaultTo('scheduled');
            t.string('status').defaultTo('pending');
            t.timestamp('scheduled_date');
            t.integer('duration_minutes').defaultTo(60);
            t.decimal('fees_charged');
            t.string('payment_status').defaultTo('pending');
            t.text('case_description');
            t.text('notes');
            t.integer('rating');
            t.text('review_text');
            t.timestamp('created_at').defaultTo(knex.fn.now());
            t.timestamp('updated_at').defaultTo(knex.fn.now());
            t.timestamp('completed_at');
        });
    }

    if (!(await knex.schema.hasTable('ai_sessions'))) {
        await knex.schema.createTable('ai_sessions', (t) => {
            t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
            t.uuid('citizen_id').notNullable().references('id').inTable('citizens').onDelete('CASCADE');
            t.timestamp('session_start').defaultTo(knex.fn.now());
            t.timestamp('session_end');
            t.string('topic');
            t.integer('messages_count').defaultTo(0);
            t.boolean('escalated_to_lawyer').defaultTo(false);
            t.uuid('escalated_consultation_id').references('id').inTable('consultations');
            t.timestamp('created_at').defaultTo(knex.fn.now());
        });
    }

    if (!(await knex.schema.hasTable('ai_messages'))) {
        await knex.schema.createTable('ai_messages', (t) => {
            t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
            t.uuid('session_id').notNullable().references('id').inTable('ai_sessions').onDelete('CASCADE');
            t.string('sender').notNullable();
            t.text('message_text').notNullable();
            t.timestamp('created_at').defaultTo(knex.fn.now());
        });
    }

    if (!(await knex.schema.hasTable('lawyer_documents'))) {
        await knex.schema.createTable('lawyer_documents', (t) => {
            t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
            t.uuid('lawyer_id').notNullable().references('id').inTable('lawyers').onDelete('CASCADE');
            t.string('document_type').notNullable();
            t.string('document_url').notNullable();
            t.boolean('verified').defaultTo(false);
            t.uuid('verified_by').references('id').inTable('admins');
            t.timestamp('verified_at');
            t.timestamp('uploaded_at').defaultTo(knex.fn.now());
        });
    }

    if (!(await knex.schema.hasTable('audit_logs'))) {
        await knex.schema.createTable('audit_logs', (t) => {
            t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
            t.string('user_type');
            t.uuid('user_id');
            t.string('action').notNullable();
            t.string('table_name');
            t.uuid('record_id');
            t.jsonb('old_values');
            t.jsonb('new_values');
            t.string('ip_address');
            t.text('user_agent');
            t.timestamp('created_at').defaultTo(knex.fn.now());
        });
    }

    if (!(await knex.schema.hasTable('notifications'))) {
        await knex.schema.createTable('notifications', (t) => {
            t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
            t.string('user_type').notNullable();
            t.uuid('user_id').notNullable();
            t.string('title').notNullable();
            t.text('message').notNullable();
            t.string('notification_type');
            t.boolean('is_read').defaultTo(false);
            t.timestamp('created_at').defaultTo(knex.fn.now());
        });
    }

    if (!(await knex.schema.hasTable('platform_statistics'))) {
        await knex.schema.createTable('platform_statistics', (t) => {
            t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
            t.date('date').notNullable().unique();
            t.integer('total_citizens').defaultTo(0);
            t.integer('total_lawyers').defaultTo(0);
            t.integer('total_approved_lawyers').defaultTo(0);
            t.integer('total_pending_lawyers').defaultTo(0);
            t.integer('total_consultations').defaultTo(0);
            t.integer('total_completed_consultations').defaultTo(0);
            t.decimal('total_revenue').defaultTo(0.00);
            t.integer('total_ai_sessions').defaultTo(0);
            t.timestamp('created_at').defaultTo(knex.fn.now());
            t.timestamp('updated_at').defaultTo(knex.fn.now());
        });
    }
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('platform_statistics');
    await knex.schema.dropTableIfExists('notifications');
    await knex.schema.dropTableIfExists('audit_logs');
    await knex.schema.dropTableIfExists('lawyer_documents');
    await knex.schema.dropTableIfExists('ai_messages');
    await knex.schema.dropTableIfExists('ai_sessions');
    await knex.schema.dropTableIfExists('consultations');
    await knex.schema.dropTableIfExists('lawyers');
    await knex.schema.dropTableIfExists('citizens');
    await knex.schema.dropTableIfExists('admins');
};
