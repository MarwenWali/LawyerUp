exports.up = function (knex) {
    return knex.schema.alterTable('lawyers', (table) => {
        table.timestamp('rejected_at');
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable('lawyers', (table) => {
        table.dropColumn('rejected_at');
    });
};
