const { Octokit } = require("@octokit/rest");

class GitHubService {
  constructor() {
    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
    });
  }

  async getUserProfile(username) {
    try {
      const { data: user } = await this.octokit.rest.users.getByUsername({
        username: username,
      });

      return {
        id: user.id,
        username: user.login,
        name: user.name || user.login,
        platform: "github",
        followers: user.followers,
        following: user.following,
        posts: user.public_repos,
        bio: user.bio || "",
        profile_url: user.html_url,
        verified: user.site_admin,
        created_at: user.created_at,
        updated_at: new Date().toISOString(),
      };
    } catch (error) {
      console.error("GitHub API Error:", error);
      throw error;
    }
  }

  async getUserFollowers(username) {
    try {
      const { data: followers } =
        await this.octokit.rest.users.listFollowersForUser({
          username: username,
          per_page: 100,
        });

      return followers.map((follower) => ({
        id: follower.id,
        username: follower.login,
        profile_url: follower.html_url,
      }));
    } catch (error) {
      console.error("GitHub Followers Error:", error);
      return [];
    }
  }

  async findMutualConnections(usernames) {
    const connections = [];

    for (let i = 0; i < usernames.length; i++) {
      for (let j = i + 1; j < usernames.length; j++) {
        try {
          const [user1Followers, user2Followers] = await Promise.all([
            this.getUserFollowers(usernames[i]),
            this.getUserFollowers(usernames[j]),
          ]);

          const mutualFollowers = user1Followers.filter((f1) =>
            user2Followers.some((f2) => f2.id === f1.id)
          );

          if (mutualFollowers.length > 0) {
            connections.push({
              source_username: usernames[i],
              target_username: usernames[j],
              connection_strength: Math.min(mutualFollowers.length / 20, 1),
              connection_type: "mutual_followers",
              mutual_count: mutualFollowers.length,
            });
          }
        } catch (error) {
          console.error("GitHub mutual connections error:", error);
        }
      }
    }

    return connections;
  }
}

module.exports = new GitHubService();
