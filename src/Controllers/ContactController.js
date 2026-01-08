import transporter from "../Utils/EmailTransport.js";

export const sendContactEmail = async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ success: false, message: "Name, email and message are required." });
    }

    const adminEmail = process.env.EMAIL_ADMIN;

    // Email to site admin
    const mailOptionsToAdmin = {
      from: adminEmail,
      to: adminEmail,
      subject: `Contact form: ${subject || 'New message from website'}`,
      html: `
        <h3>New contact form submission</h3>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Subject:</strong> ${subject || ''}</p>
        <p><strong>Message:</strong><br/>${message.replace(/\n/g, '<br/>')}</p>
      `,
    };

    // Acknowledge to user
    const mailOptionsToUser = {
      from: adminEmail,
      to: email,
      subject: `Thanks for contacting Schoolemy${subject ? ` — ${subject}` : ''}`,
      html: `
        <div style="font-family: Arial, sans-serif;">
          <h3>Hi ${name},</h3>
          <p>Thanks for reaching out to Schoolemy. We have received your message and will get back to you shortly.</p>
          <p><strong>Your message:</strong></p>
          <div style="border-left:3px solid #eee;padding-left:8px;color:#333">${message.replace(/\n/g, '<br/>')}</div>
          <hr/>
          <p style="color:#777;">© 2025 Schoolemy</p>
        </div>
      `,
    };

    // Send both emails
    await transporter.sendMail(mailOptionsToAdmin);
    await transporter.sendMail(mailOptionsToUser);

    return res.status(200).json({ success: true, message: "Message sent successfully." });
  } catch (error) {
    console.error("Error in sendContactEmail:", error);
    return res.status(500).json({ success: false, message: "Failed to send message.", error: error.message });
  }
};

export default { sendContactEmail };