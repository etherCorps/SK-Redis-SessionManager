<a name="readme-top"></a>
[![Contributors][contributors-shield]][contributors-url]
[![Forks][forks-shield]][forks-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]
[![MIT License][license-shield]][license-url]
[![LinkedIn][linkedin-shield]][linkedin-url]

<!-- PROJECT LOGO -->
<br />
<div align="center">
  <a href="https://github.com/etherCorps/SK-Redis-SessionManager">
    <img src="static/Logo31.svg" alt="Logo" width="80" height="80">
  </a>

<h3 align="center">SvelteKit Redis Session Manager</h3>

  <p align="center">
    Redis integration in SvelteKit for  Session Management
    <br />
    <a href="https://www.npmjs.com/package/@ethercorps/sveltekit-redis-session">@ethercorps/sveltekit-redis-session</a>
    <br /> 
    <a href="https://github.com/etherCorps/SK-Redis-SessionManager#readme"><strong>Explore the docs »</strong></a>
    <br />
    <br />
    <a href="https://github.com/etherCorps/SK-Redis-SessionManager">View Demo</a>
    ·
    <a href="https://github.com/etherCorps/SK-Redis-SessionManager/issues">Report Bug</a>
    ·
    <a href="https://github.com/etherCorps/SK-Redis-SessionManager/issues">Request Feature</a>
  </p>
</div>

<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
      <ul>
        <li><a href="#built-with">Built With</a></li>
      </ul>
    </li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#setup">Installation</a></li>
      </ul>
    </li>
    <li><a href="#usage">Usage</a></li>
    <li><a href="#roadmap">Roadmap</a></li>
    <li><a href="#license">License</a></li>
    <li><a href="#contact">Contact</a></li>
    <li><a href="#acknowledgments">Acknowledgments</a></li>
  </ol>
</details>

<!-- ABOUT THE PROJECT -->

## About The Project

[//]: # '[![Product Name Screen Shot][product-screenshot]](https://github.com/etherCorps/SK-Redis-SessionManager)'

"sveltekit-redis-session" makes it easy for developers to use Redis as a session manager in SvelteKit
applications. It offers a variety of convenient features that make managing user sessions a breeze. This includes simple
functions for storing and retrieving data, encryption of session data for added security, and automatic handling of
session expiration. Additionally, the package is highly customizable, which allows developers to adjust it to their
specific requirements and optimize performance (COPY MY CODE BUT LEARN).
Overall, "sveltekit-redis-session" is choice for managing user sessions in any SvelteKit application thanks to SvelteKit package for robust functionality and flexibility.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### Built With

- [![SvelteKit][SveletKit]][SvelteKit-url]
- [![Redis][Redis]][Redis-url]
- [![Svelte][Svelte.dev]][Svelte-url]

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- GETTING STARTED -->

## Getting Started

This is an example of how you may give instructions on setting up your project locally.
To get a local copy up and running follow these simple example steps.

### Prerequisites

This is an example of how to list things you need to use the software and how to install them.

- Install the sveltekit-redis-session
  ```sh
  pnpm i @ethercorps/sveletkit-redis-session
  ```

### Setup

1. First we need to make instance of it to use everywhere in project.
    ```ts
    import { RedisSessionStore } from "@ethercorps/sveletkit-redis-session";
    import Redis from "ioredis";
    export const sessionManager = new RedisSessionStore({
      redisClient: new Redis(),  // Required A pre-initiated redis client 
      secret: 'your-secret-key', // Required A secret key for encryption and other things,
      cookieName: 'session',  // CookieName to be saved in cookies for browser Default session
      prefix: 'sk-session',  // Prefix for Redis Keys Default sk-session
      signed: true, // Do you want to sign your cookies Default true
      encrypted: false,  // Do you want to encrypt your cookies using 'aes-256-cbc' algorithm Default false
      useTTL: true, // Do you wanna use redis's Expire key functionality Default false
      renewSessionBeforeExpire: false, // Do you wanna update session expire time in built function Default false
      renewBeforeSeconds: 30 * 60, // If renewSessionBeforeExpire is true define your renew before time in seconds Default 30 minutes
      serializer: JSON, // You can define your own serializer functions to stringify and parse sessionData for redis Default JSON
      cookiesOptions: {
        path: '/',
        httpOnly: true,
        sameSite: 'strict',
        secure: !dev, // From SvelteKit "$app/environment"
        maxAge: 60 * 60 * 24 // You have to define time in seconds and it's also used for redis key expiry time
      } // You have more options these are default used in package for more check sveltekit CookieSerializeOptions type.
   })
    ```
   > These are the default config example you can use as per your need and make it better for your use.
    I have written an article to explain more about this package <a href="">link for article</a>.
   
2. To create new session and add cookies for user after authentication
    ```ts
   // Example it's a +page.server.ts
    import sessionManager from "sessionManagerFile"
   
    export const actions: Actions = {
    login: async ({req, cookies, locals}) => {
      const formdata = await request.formData()
      // Form validation && user validation
      const { data, error, message } = sessionManager.setNewSession(cookies, userData)
      // data is the value we added to cookies, check for error which is a boolean and message.
      /* add data to locals too for accessing data from client */
      throw redirect(307, '/dashboard');
      }
   }
    ```
3. To get session data for the cookie
   ```ts
   /* hooks.server.ts */
   import sessionManager from "sessionManagerFile"
   
   export const handle: Handle = async ({ event, resolve }) => {
   /* your validation logic */
   const { data, error, message } = sessionManager.getSession(event.cookies)
   // data is the User session data we saved to redis while login, check for error which is a boolean and message.
   /* do error check and then set data to locals as per your logic */
   }
  
   ```
4. To update session expiry in redis and cookies
    ```ts
   // in any server side file or endpoint where you can access browser cookies
    import sessionManager from "sessionManagerFile"
    const { data, error, message } = await sessionManager.updateSessionExpiry(cookies)
    // data is going to be null or key which is updated, error is a boolean value and message a string
    ```
5. To delete session from redis and cookie from browser
   ```ts
   // Example it's a +page.server.ts
   
   import sessionManager from "sessionManagerFile"
   export const actions: Actions = {
     logout: async ({cookies, locals}) => {
       const { data, error, message } = await sessionManager.delSession(cookies)
       // data is the value we deleted key, check for error which is a boolean and message.
       /* clear your locals too */
       throw redirect(307, '/login');
     }
   }
   ```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- USAGE EXAMPLES -->

## Usage

Examples are going to be added soon.

_For more examples, please refer to the [Examples](https://github.com/etherCorps/SK-Redis-SessionManager/tree/master/examples)_

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- ROADMAP -->

## Roadmap

See the [open issues](https://github.com/etherCorps/SK-Redis-SessionManager/issues) for a full list of proposed
features (and known issues).

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- CONTRIBUTING -->

[//]: # (## Contributing)

[//]: # ()
[//]: # (Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any)

[//]: # (contributions you make are **greatly appreciated**.)

[//]: # ()
[//]: # (If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also)

[//]: # (simply open an issue with the tag "enhancement".)

[//]: # (Don't forget to give the project a star! Thanks again!)

[//]: # ()
[//]: # (1. Fork the Project)

[//]: # (2. Create your Feature Branch &#40;`git checkout -b feature/AmazingFeature`&#41;)

[//]: # (3. Commit your Changes &#40;`git commit -m 'Add some AmazingFeature'`&#41;)

[//]: # (4. Push to the Branch &#40;`git push origin feature/AmazingFeature`&#41;)

[//]: # (5. Open a Pull Request)

[//]: # ()
[//]: # (<p align="right">&#40;<a href="#readme-top">back to top</a>&#41;</p>)

<!-- LICENSE -->

## License

Distributed under the MIT License. See `LICENSE.txt` for more information.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- CONTACT -->

## Contact

Your Name - [@theether0](https://twitter.com/theether0) - meenashivam9650@gmail.com

Project
Link: [https://github.com/etherCorps/SK-Redis-SessionManager](https://github.com/etherCorps/SK-Redis-SessionManager)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- ACKNOWLEDGMENTS -->

## Acknowledgments

- [logos-by-larkef from landingfolio](https://www.landingfolio.com/logos-by-larkef) :: For logo
- [connect-redis by TJ Holowaychuk](https://github.com/tj/connect-redis/tree/master) :: Creator of connect redis for express session.
- []()

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- MARKDOWN LINKS & IMAGES -->
<!-- https://www.markdownguide.org/basic-syntax/#reference-style-links -->

[contributors-shield]: https://img.shields.io/github/contributors/etherCorps/SK-Redis-SessionManager.svg?style=for-the-badge
[contributors-url]: https://github.com/etherCorps/SK-Redis-SessionManager/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/etherCorps/SK-Redis-SessionManager.svg?style=for-the-badge
[forks-url]: https://github.com/etherCorps/SK-Redis-SessionManager/network/members
[stars-shield]: https://img.shields.io/github/stars/etherCorps/SK-Redis-SessionManager.svg?style=for-the-badge
[stars-url]: https://github.com/etherCorps/SK-Redis-SessionManager/stargazers
[issues-shield]: https://img.shields.io/github/issues/etherCorps/SK-Redis-SessionManager.svg?style=for-the-badge
[issues-url]: https://github.com/etherCorps/SK-Redis-SessionManager/issues
[license-shield]: https://img.shields.io/github/license/etherCorps/SK-Redis-SessionManager.svg?style=for-the-badge
[license-url]: https://github.com/etherCorps/SK-Redis-SessionManager/blob/master/LICENSE.txt
[linkedin-shield]: https://img.shields.io/badge/-LinkedIn-black.svg?style=for-the-badge&logo=linkedin&colorB=555
[linkedin-url]: https://linkedin.com/in/theether0
[product-screenshot]: static/screenshot.png
[SveletKit]: https://img.shields.io/badge/sveltekit-000000?style=for-the-badge&logo=svelte&logoColor=white
[SvelteKit-url]: https://kit.svelte.dev
[Redis]: https://img.shields.io/badge/Redis-DD0031?style=for-the-badge&logo=Redis&logoColor=white
[Redis-url]: https://redis.io/
[Svelte.dev]: https://img.shields.io/badge/Svelte-4A4A55?style=for-the-badge&logo=svelte&logoColor=FF3E00
[Svelte-url]: https://svelte.dev/
