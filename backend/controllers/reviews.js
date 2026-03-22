import pool from '../config/database.js';

export async function getLawyerReviews(req, res) {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT r.id, r.rating, r.comment, r.created_at, r.user_id,
              u.full_name as reviewer_name, u.profile_photo_url as reviewer_photo
       FROM reviews r
       JOIN users u ON r.user_id = u.id
       WHERE r.lawyer_id = $1
       ORDER BY r.created_at DESC`,
      [id]
    );

    const avg = result.rows.length
      ? result.rows.reduce((sum, r) => sum + parseFloat(r.rating), 0) / result.rows.length
      : 0;

    const breakdown = [5, 4, 3, 2, 1].map(star => ({
      star,
      count: result.rows.filter(r => parseInt(r.rating) === star).length,
    }));

    res.json({
      reviews: result.rows,
      averageRating: parseFloat(avg.toFixed(2)),
      count: result.rows.length,
      breakdown,
    });
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
}

export async function getMyReview(req, res) {
  try {
    const { lawyerId } = req.params;
    const result = await pool.query(
      `SELECT * FROM reviews WHERE user_id = $1 AND lawyer_id = $2 LIMIT 1`,
      [req.user.id, lawyerId]
    );
    res.json({ review: result.rows[0] || null });
  } catch (error) {
    console.error('Get my review error:', error);
    res.status(500).json({ error: 'Failed to fetch your review' });
  }
}

export async function submitReview(req, res) {
  try {
    const { lawyerId, rating, comment } = req.body;

    if (!lawyerId || !rating) {
      return res.status(400).json({ error: 'Lawyer ID and rating are required' });
    }
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    const lawyerCheck = await pool.query(
      `SELECT id FROM users WHERE id = $1 AND role = 'lawyer'`, [lawyerId]
    );
    if (lawyerCheck.rows.length === 0) return res.status(404).json({ error: 'Lawyer not found' });

    const existing = await pool.query(
      `SELECT id FROM reviews WHERE user_id = $1 AND lawyer_id = $2 LIMIT 1`,
      [req.user.id, lawyerId]
    );

    let result;
    if (existing.rows.length > 0) {
      result = await pool.query(
        `UPDATE reviews SET rating = $1, comment = $2 WHERE id = $3 RETURNING *`,
        [rating, comment || null, existing.rows[0].id]
      );
    } else {
      result = await pool.query(
        `INSERT INTO reviews (user_id, lawyer_id, rating, comment) VALUES ($1, $2, $3, $4) RETURNING *`,
        [req.user.id, lawyerId, rating, comment || null]
      );
    }

    await pool.query(
      `UPDATE lawyer_profiles
       SET rating = (SELECT ROUND(AVG(rating)::numeric, 2) FROM reviews WHERE lawyer_id = $1),
           cases_handled = (SELECT COUNT(*) FROM reviews WHERE lawyer_id = $1)
       WHERE user_id = $1`,
      [lawyerId]
    );

    res.status(201).json({ review: result.rows[0] });
  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({ error: 'Failed to create review' });
  }
}

export async function deleteReview(req, res) {
  try {
    const result = await pool.query(
      `DELETE FROM reviews WHERE id = $1 AND user_id = $2 RETURNING lawyer_id`,
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Review not found or not yours' });

    const lawyerId = result.rows[0].lawyer_id;
    await pool.query(
      `UPDATE lawyer_profiles
       SET rating = COALESCE((SELECT ROUND(AVG(rating)::numeric, 2) FROM reviews WHERE lawyer_id = $1), 0)
       WHERE user_id = $1`,
      [lawyerId]
    );
    res.json({ message: 'Review deleted' });
  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({ error: 'Failed to delete review' });
  }
}
