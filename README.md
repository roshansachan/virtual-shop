# Virtual Store - Next.js E-commerce Application

A modern e-commerce application built with Next.js 15, TypeScript, and Tailwind CSS.

## Features

- 🛒 Product catalog and shopping cart
- 💳 Payment processing integration ready
- 👤 User authentication system ready
- 📱 Responsive design with Tailwind CSS
- 🎨 Modern UI components
- ⚡ Fast performance with Next.js App Router
- 🔍 SEO optimized
- 📊 Admin dashboard ready

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Ready for Radix UI
- **Icons**: Ready for Lucide React
- **Database**: Ready for integration (PostgreSQL, MongoDB, etc.)
- **Authentication**: Ready for NextAuth.js integration
- **Payments**: Ready for Stripe integration
- **Deployment**: Vercel ready

## Getting Started

1. **Install additional dependencies** (recommended):
   ```bash
   npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-toast lucide-react clsx tailwind-merge
   ```

2. **Set up environment variables**:
   Update `.env.local` with your values

3. **Run the development server**:
   ```bash
   npm run dev
   ```

4. **Open your browser**:
   Navigate to [http://localhost:3000](http://localhost:3000)

## Project Structure

```
src/
├── app/                 # Next.js App Router pages
├── components/          # Reusable UI components
├── lib/                 # Utility functions and configurations
└── types/              # TypeScript type definitions
```

## Environment Variables

The following environment variables are configured in `.env.local`:

- `DATABASE_URL` - Database connection string
- `NEXTAUTH_SECRET` - Authentication secret
- `STRIPE_SECRET_KEY` - Stripe secret key for payments
- `STRIPE_PUBLISHABLE_KEY` - Stripe publishable key
- `CLOUDINARY_URL` - Image upload service

## Next Steps

1. **Set up database** (choose one):
   - PostgreSQL with Prisma
   - MongoDB with Mongoose
   - Supabase

2. **Add authentication**:
   ```bash
   npm install next-auth
   ```

3. **Add payment processing**:
   ```bash
   npm install stripe @stripe/stripe-js
   ```

4. **Add state management** (if needed):
   ```bash
   npm install zustand
   ```

## Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
