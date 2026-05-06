import pool from '../config/database.js';

export async function getAllLawyers(req, res) {
  try {
    const { specialization, available } = req.query;

    let query = `
      SELECT
        u.id, u.email, u.full_name as name, u.phone_number, u.profile_photo_url,
        lp.specialization, lp.bio, lp.experience_years, lp.rating,
        lp.cases_handled, lp.is_available, lp.consultation_fee, lp.office_address
      FROM users u
      JOIN lawyer_profiles lp ON u.id = lp.user_id
      WHERE u.role = 'lawyer' AND u.is_verified = true
    `;

    const params = [];
    if (specialization) {
      params.push(specialization);
      query += ` AND lp.specialization = $${params.length}`;
    }
    if (available !== undefined) {
      params.push(available === 'true');
      query += ` AND lp.is_available = $${params.length}`;
    }

    query += ' ORDER BY lp.rating DESC, lp.cases_handled DESC';

    const result = await pool.query(query, params);

    res.json({
      lawyers: result.rows.map(lawyer => ({
        id: lawyer.id,
        name: `Maître ${lawyer.name.replace(/^Ma[iî]tre\s+/i, '')}`,
        email: lawyer.email,
        phoneNumber: lawyer.phone_number,
        specialization: lawyer.specialization,
        bio: lawyer.bio,
        experience: lawyer.experience_years,
        rating: parseFloat(lawyer.rating),
        casesHandled: lawyer.cases_handled,
        isAvailable: lawyer.is_available,
        consultationFee: parseFloat(lawyer.consultation_fee || 0),
        officeAddress: lawyer.office_address,
        profilePhotoUrl: lawyer.profile_photo_url,
      })),
    });
  } catch (error) {
    console.error('Get lawyers error:', error);
    res.status(500).json({ error: 'Failed to fetch lawyers' });
  }
}

export async function getLawyerById(req, res) {
  try {
    const { id } = req.params;
    if (!id || id === 'undefined') return res.status(400).json({ error: 'Invalid lawyer ID' });

    const result = await pool.query(
      `SELECT
        u.id, u.email, u.full_name as name, u.phone_number, u.profile_photo_url,
        lp.specialization, lp.bio, lp.experience_years, lp.rating,
        lp.cases_handled, lp.is_available, lp.consultation_fee,
        lp.office_address, lp.bar_number
      FROM users u
      JOIN lawyer_profiles lp ON u.id = lp.user_id
      WHERE u.id = $1 AND u.role = 'lawyer'`,
      [id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Lawyer not found' });

    const lawyer = result.rows[0];
    res.json({
      id: lawyer.id,
      name: `Maître ${lawyer.name.replace(/^Ma[iî]tre\s+/i, '')}`,
      email: lawyer.email,
      phoneNumber: lawyer.phone_number,
      specialization: lawyer.specialization,
      bio: lawyer.bio,
      experience: lawyer.experience_years,
      rating: parseFloat(lawyer.rating),
      casesHandled: lawyer.cases_handled,
      isAvailable: lawyer.is_available,
      consultationFee: parseFloat(lawyer.consultation_fee || 0),
      officeAddress: lawyer.office_address,
      barNumber: lawyer.bar_number,
      profilePhotoUrl: lawyer.profile_photo_url,
    });
  } catch (error) {
    console.error('Get lawyer error:', error);
    res.status(500).json({ error: 'Failed to fetch lawyer' });
  }
}

export async function setAvailability(req, res) {
  try {
    if (req.user.role !== 'lawyer') {
      return res.status(403).json({ error: 'Only lawyers can update availability' });
    }
    const { isAvailable } = req.body;
    if (typeof isAvailable !== 'boolean') {
      return res.status(400).json({ error: 'isAvailable must be a boolean' });
    }
    const result = await pool.query(
      `UPDATE lawyer_profiles SET is_available = $1 WHERE user_id = $2 RETURNING is_available`,
      [isAvailable, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Lawyer profile not found' });
    res.json({ isAvailable: result.rows[0].is_available });
  } catch (error) {
    console.error('Toggle availability error:', error);
    res.status(500).json({ error: 'Failed to update availability' });
  }
}

export async function updateProfile(req, res) {
  try {
    if (req.user.role !== 'lawyer') {
      return res.status(403).json({ error: 'Only lawyers can update profile' });
    }

    const { bio, specialization, isAvailable, consultationFee, officeAddress, barNumber } = req.body;

    const result = await pool.query(
      `UPDATE lawyer_profiles
       SET bio = COALESCE($1, bio),
           specialization = COALESCE($2, specialization),
           is_available = COALESCE($3, is_available),
           consultation_fee = COALESCE($4, consultation_fee),
           office_address = COALESCE($5, office_address),
           bar_number = COALESCE($6, bar_number)
       WHERE user_id = $7
       RETURNING *`,
      [bio, specialization, isAvailable, consultationFee, officeAddress, barNumber, req.user.id]
    );

    res.json({ message: 'Profile updated successfully', profile: result.rows[0] });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
}

export async function createAppointment(req, res) {
  try {
    if (req.user.role !== 'lawyer') return res.status(403).json({ error: 'Unauthorized' });
    const { title, type, date, location, user_id } = req.body;
    const finalUserId = user_id || req.user.id;
    const result = await pool.query(
      `INSERT INTO appointments (user_id, title, type, date, location, lawyer_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [finalUserId, title, type, date, location || null, req.user.id]
    );
    res.status(201).json({ appointment: result.rows[0] });
  } catch (error) {
    console.error('createAppointment error:', error);
    res.status(500).json({ error: 'Failed to create appointment' });
  }
}
