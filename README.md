# Cultivate - Cultivate

Welcome to Cultivate, a comprehensive system for tracking and managing community-building activities. Whether you're organizing study circles, children's classes, devotional gatherings, or other community programs, Cultivate helps you stay organized and understand your community's growth.

## What is Cultivate?

Cultivate is a multi-platform application that helps community organizers:

- **Track Activities**: Manage all your community activities in one place
- **Manage Participants**: Keep track of everyone involved in your community
- **Organize Locations**: Map venues and geographic areas where activities occur
- **Analyze Growth**: Understand engagement patterns and community development
- **Work Offline**: Continue working even without internet connectivity
- **Access Anywhere**: Use on any web browser from your computer or tablet

## Key Features

### 1. Activity Management

**What You Can Do:**
- Create different types of activities (study circles, children's classes, devotional gatherings, etc.)
- Track activity status (Planning, Active, Completed, Archived)
- Set start and end dates, or mark activities as ongoing
- Associate activities with specific venues
- Track venue changes over time for activities that move locations

**How to Use:**
1. Navigate to the Activities section
2. Click "Create New Activity"
3. Fill in the activity details (name, type, dates, venue)
4. Assign participants with their roles
5. Update the status as the activity progresses

### 2. Participant Management

**What You Can Do:**
- Add and manage participant information
- Track participant roles (Facilitator, Animator, Host, Teacher, etc.)
- Assign participants to activities
- Maintain participant home addresses with full history
- View all activities a participant is involved in

**How to Use:**
1. Go to the Participants section
2. Click "Add New Participant"
3. Enter participant details (name, contact information, home address)
4. Assign them to activities with appropriate roles
5. Update their information as needed (address changes are tracked automatically)

### 3. Venue and Location Tracking

**What You Can Do:**
- Create venues for public buildings and private residences
- Organize venues into geographic areas (neighborhoods, communities, cities, etc.)
- Track participant home addresses as venues
- View venue history for activities and participants
- Search and filter venues by location

**How to Use:**
1. Navigate to the Venues section
2. Click "Create New Venue"
3. Enter the venue details (name, address, type)
4. Associate it with a geographic area
5. Optionally add coordinates for map display

### 4. Geographic Organization

**What You Can Do:**
- Create a hierarchy of geographic areas (neighborhood → community → city → cluster → county → province → state → country → continent → hemisphere → world)
- Organize venues within geographic areas
- View statistics for any geographic level
- Understand geographic patterns in community engagement

**How to Use:**
1. Go to the Geographic Areas section
2. Create areas from largest to smallest (e.g., start with your country, then province, then city)
3. Set parent-child relationships to build the hierarchy
4. Associate venues with the appropriate geographic area
5. View aggregated statistics at any level

### 5. Interactive Maps

**What You Can Do:**
- View all venues on an interactive map
- See which activities occur at each location
- Filter map markers by activity type, status, or date range
- Visualize geographic patterns in community engagement
- View participant home addresses (with appropriate privacy settings)

**How to Use:**
1. Navigate to the Map View
2. Zoom and pan to explore different areas
3. Click on venue markers to see activity information
4. Use the filter controls to show specific types of activities
5. Toggle layers to show/hide different information

### 6. Analytics and Insights

**What You Can Do:**
- View comprehensive engagement metrics with temporal analysis
- Track activities at the start and end of date ranges
- Monitor activities started, completed, and cancelled
- Analyze participation patterns by activity type
- Group data by activity type, venue, geographic area, or date
- Filter by multiple criteria to answer specific questions
- Compare engagement across different geographic regions
- Understand role distribution across activities

**Example Questions You Can Answer:**
- "How many activities were active at the start of the quarter vs. the end?"
- "Which activity types had the most new activities started this month?"
- "What's the participant growth in the downtown area over the past year?"
- "How does engagement compare across different neighborhoods?"
- "What's the role distribution in our study circles?"

**How to Use:**
1. Go to the Analytics section
2. Select your date range (or leave blank for all-time metrics)
3. Choose grouping options (by activity type, venue, geographic area, or date)
4. Apply filters to focus on specific segments
5. View charts and tables showing your community's patterns
6. Export data for further analysis if needed

### 7. Offline Capability

**What You Can Do:**
- Continue working without internet connectivity
- Create, edit, and delete activities and participants offline
- View all your data even when disconnected
- Automatic synchronization when connectivity returns

**How It Works:**
1. The app automatically saves your data locally
2. When offline, you'll see an indicator in the app
3. All your changes are queued for synchronization
4. When you reconnect, changes sync automatically
5. If conflicts occur, you'll be notified to resolve them

### 8. User Roles and Permissions

**Three User Roles:**

- **Administrator**: Full access to create, edit, and delete all data
- **Editor**: Can create and edit data, but cannot delete
- **Read-Only**: Can view all data but cannot make changes

**How to Manage:**
1. Administrators can assign roles to users
2. Navigate to the Users section
3. Select a user and change their role
4. Changes take effect immediately

## Getting Started

### Web Application

1. Open your web browser (Chrome, Firefox, Safari, or Edge recommended)
2. Navigate to the Cultivate web address
3. Log in with your credentials
4. Start exploring the dashboard

The web application works on desktop computers, laptops, and tablets. For the best experience on tablets, you can add Cultivate to your home screen for quick access.

## Common Workflows

### Starting a New Activity

1. Create or select an activity type
2. Create a new activity with that type
3. Set the start date and status to "Planning"
4. Associate it with a venue
5. Add participants with their roles
6. Change status to "Active" when the activity begins
7. Update to "Completed" when finished

### Tracking Community Growth

1. Go to Analytics
2. Select a date range (e.g., last quarter)
3. View engagement metrics to see:
   - Activities at start vs. end of period
   - New activities started
   - Activities completed or cancelled
   - Participant counts and changes
4. Group by geographic area to see regional patterns
5. Group by activity type to compare different programs
6. Use filters to focus on specific segments

### Managing Participant Addresses

1. Go to Participants
2. Select a participant
3. View their address history
4. When they move, update their home venue
5. The system automatically tracks the change with the effective date
6. View the complete history of address changes

### Organizing Geographic Areas

1. Start with the largest area (e.g., your country)
2. Create child areas (provinces/states)
3. Continue creating smaller areas (cities, neighborhoods)
4. Associate venues with the most specific area
5. View statistics at any level to see aggregated data

## Tips for Success

### Best Practices

- **Regular Updates**: Keep activity statuses current
- **Consistent Naming**: Use consistent names for activity types and roles
- **Geographic Organization**: Set up your geographic hierarchy before adding many venues
- **Venue Coordinates**: Add latitude/longitude to venues for map visualization
- **Offline Preparation**: Sync before going to areas with poor connectivity
- **Role Clarity**: Assign clear, meaningful roles to participants

### Data Quality

- **Avoid Duplicates**: Search before creating new participants or venues
- **Complete Information**: Fill in as much detail as possible
- **Regular Reviews**: Periodically review and update participant information
- **Archive Old Activities**: Move completed activities to "Archived" status
- **Verify Addresses**: Ensure venue addresses are accurate for mapping

### Getting Help

- **In-App Help**: Look for help icons throughout the application
- **User Guides**: Check the documentation section for detailed guides
- **Support**: Contact your system administrator for assistance
- **Training**: Attend training sessions to learn advanced features

## Technical Information

### System Architecture

Cultivate consists of three main components:

1. **Infrastructure**: Cloud hosting on AWS
2. **Backend API**: RESTful service for data management
3. **Web Frontend**: React-based web application with offline support

### Data Synchronization

- The web application stores data locally for offline access
- Changes sync automatically when online
- Conflicts are resolved using last-write-wins strategy
- You'll be notified if conflicts require your attention

### Security

- All data is encrypted in transit (HTTPS)
- All data is encrypted at rest (database encryption)
- Passwords are securely hashed
- Authentication uses industry-standard JWT tokens
- Role-based access control protects sensitive operations

### Privacy

- Participant information is protected
- Home addresses are only visible to authorized users
- Audit logs track all data changes
- Data is backed up regularly

## Frequently Asked Questions

**Q: What happens if I lose internet connectivity?**
A: The app continues to work offline. Your changes are saved locally and will sync automatically when you reconnect.

**Q: Can I use Cultivate on multiple devices?**
A: Yes! Your data syncs across all devices. You can access Cultivate from any web browser on different computers or tablets.

**Q: How do I handle duplicate participants?**
A: Search carefully before creating new participants. If you find duplicates, contact your administrator to merge them.

**Q: Can I export my data?**
A: Yes, analytics data can be exported. Contact your administrator for bulk data exports.

**Q: What if two people edit the same activity at the same time?**
A: The system uses last-write-wins conflict resolution. The most recent change is kept, and you'll be notified if a conflict occurs.

**Q: How far back does the system track history?**
A: All historical data is retained indefinitely, including participant address changes and activity venue changes.

**Q: Can I customize activity types and roles?**
A: Yes! Administrators can create custom activity types and participant roles in addition to the predefined ones.

**Q: How do I report a bug or request a feature?**
A: Contact your system administrator, who will coordinate with the development team.

## Version History

This document is maintained alongside the system and updated as new features are added.

**Current Version**: 1.0.0

For detailed technical documentation, see the `/docs` directory.

---

**Need Help?** Contact your system administrator or refer to the detailed documentation in the `/docs` folder.
