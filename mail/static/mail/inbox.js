// Track current mailbox
let current_mailbox = 'inbox';

document.addEventListener('DOMContentLoaded', function() {

  // Center login/register pages - add class to body for CSS targeting
  const loginForm = document.querySelector('form[action*="login"]');
  const registerForm = document.querySelector('form[action*="register"]');
  if (loginForm || registerForm) {
    document.body.classList.add('auth-page');
  }

  // Create email-view div if it doesn't exist (all implementation in inbox.js)
  if (!document.querySelector('#email-view')) {
    const emailView = document.createElement('div');
    emailView.id = 'email-view';
    emailView.style.display = 'none';
    document.querySelector('#compose-view').parentNode.appendChild(emailView);
  }

  // Use buttons to toggle between views
  document.querySelector('#inbox').addEventListener('click', () => load_mailbox('inbox'));
  document.querySelector('#sent').addEventListener('click', () => load_mailbox('sent'));
  document.querySelector('#archived').addEventListener('click', () => load_mailbox('archive'));
  document.querySelector('#compose').addEventListener('click', compose_email);

  // Handle compose form submission
  document.querySelector('#compose-form').addEventListener('submit', send_email);

  // By default, load the inbox
  load_mailbox('inbox');
});

function compose_email() {

  // Show compose view and hide other views
  document.querySelector('#emails-view').style.display = 'none';
  document.querySelector('#compose-view').style.display = 'block';
  document.querySelector('#email-view').style.display = 'none';

  // Clear out composition fields
  document.querySelector('#compose-recipients').value = '';
  document.querySelector('#compose-subject').value = '';
  document.querySelector('#compose-body').value = '';
}

function load_mailbox(mailbox) {
  
  // Update current mailbox
  current_mailbox = mailbox;
  
  // Show the mailbox and hide other views
  document.querySelector('#emails-view').style.display = 'block';
  document.querySelector('#compose-view').style.display = 'none';
  document.querySelector('#email-view').style.display = 'none';

  // Show the mailbox name
  document.querySelector('#emails-view').innerHTML = `<h3>${mailbox.charAt(0).toUpperCase() + mailbox.slice(1)}</h3>`;

  // Fetch emails for the mailbox
  fetch(`/emails/${mailbox}`)
    .then(response => response.json())
    .then(emails => {
      // Print emails
      console.log(emails);

      // Display emails
      const emailsView = document.querySelector('#emails-view');
      emails.forEach(email => {
        const emailElement = document.createElement('div');
        emailElement.classList.add('email-item');
        emailElement.classList.add(email.read ? 'read' : 'unread');

        emailElement.innerHTML = `
          <div>
            <div class="email-sender"><strong>${email.sender}</strong></div>
            <div class="email-subject">${email.subject}</div>
          </div>
          <div class="email-timestamp">${email.timestamp}</div>
        `;
        
        emailElement.addEventListener('click', function() {
          view_email(email.id);
        });
        
        emailsView.appendChild(emailElement);
      });
    })
    .catch(error => {
      console.error('Error:', error);
    });
}

function send_email(event) {
  event.preventDefault();

  // Get form values
  const recipients = document.querySelector('#compose-recipients').value;
  const subject = document.querySelector('#compose-subject').value;
  const body = document.querySelector('#compose-body').value;

  // Send POST request to /emails
  fetch('/emails', {
    method: 'POST',
    body: JSON.stringify({
      recipients: recipients,
      subject: subject,
      body: body
    })
  })
    .then(response => response.json())
    .then(result => {
      // Print result
      console.log(result);
      
      // Load sent mailbox after sending
      load_mailbox('sent');
    })
    .catch(error => {
      console.error('Error:', error);
    });
}

function view_email(email_id) {
  // Hide other views and show email view
  document.querySelector('#emails-view').style.display = 'none';
  document.querySelector('#compose-view').style.display = 'none';
  document.querySelector('#email-view').style.display = 'block';

  // Fetch the email
  fetch(`/emails/${email_id}`)
    .then(response => response.json())
    .then(email => {
      // Print email
      console.log(email);

      // Get current user email
      const userEmail = document.querySelector('h2').textContent;
      
      // Determine if archive/unarchive button should be shown
      // Only show for inbox/archive mailboxes, not sent
      let archiveButton = '';
      if (current_mailbox === 'inbox' && !email.archived && email.recipients.includes(userEmail)) {
        archiveButton = '<button class="btn btn-sm btn-outline-primary pill-btn" id="archive-btn">Archive</button>';
      } else if (current_mailbox === 'archive' && email.archived) {
        archiveButton = '<button class="btn btn-sm btn-outline-primary pill-btn" id="archive-btn">Unarchive</button>';
      }

      // Display the email with inline styles (all in inbox.js)
      const emailView = document.querySelector('#email-view');
      emailView.innerHTML = `
        <div class="email-detail">
          <div class="email-field"><strong>From:</strong> ${email.sender}</div>
          <div class="email-field"><strong>To:</strong> ${email.recipients.join(', ')}</div>
          <div class="email-field"><strong>Subject:</strong> ${email.subject}</div>
          <div class="email-field"><strong>Timestamp:</strong> ${email.timestamp}</div>
          <div class="email-actions">
            ${archiveButton}
            <button class="btn btn-sm btn-outline-primary pill-btn" id="reply-btn">Reply</button>
          </div>
          <hr>
          <div class="email-body">${email.body}</div>
        </div>
      `;

      // Mark email as read
      fetch(`/emails/${email_id}`, {
        method: 'PUT',
        body: JSON.stringify({
          read: true
        })
      });

      // Add event listener for archive button
      const archiveBtn = document.querySelector('#archive-btn');
      if (archiveBtn) {
        archiveBtn.addEventListener('click', function() {
          fetch(`/emails/${email_id}`, {
            method: 'PUT',
            body: JSON.stringify({
              archived: !email.archived
            })
          })
            .then(() => {
              load_mailbox('inbox');
            });
        });
      }

      // Add event listener for reply button
      const replyBtn = document.querySelector('#reply-btn');
      replyBtn.addEventListener('click', function() {
        // Determine subject prefix
        let replySubject = email.subject;
        if (!replySubject.startsWith('Re: ')) {
          replySubject = 'Re: ' + replySubject;
        }

        // Quote original body like typical email clients (each line prefixed with "> ")
        const quotedBody = email.body
          .split('\n')
          .map(line => `> ${line}`)
          .join('\n');

        // Reply body: blank space for your text, then quoted original message
        const replyBody = `\n\nOn ${email.timestamp} ${email.sender} wrote:\n${quotedBody}`;

        // Show compose view first
        compose_email();

        // Pre-fill compose form after showing the view
        document.querySelector('#compose-recipients').value = email.sender;
        document.querySelector('#compose-subject').value = replySubject;
        const bodyField = document.querySelector('#compose-body');
        bodyField.value = replyBody;

        // Place cursor at the top so you can start typing your reply above the quoted text
        bodyField.selectionStart = 0;
        bodyField.selectionEnd = 0;
      });
    })
    .catch(error => {
      console.error('Error:', error);
    });
}