import { getPrismaClient, disconnectPrisma } from '../../utils/prisma.client';

describe('Prisma Client', () => {
    describe('getPrismaClient', () => {
        it('should return a Prisma client instance', () => {
            const client = getPrismaClient();

            expect(client).toBeDefined();
            expect(client).toHaveProperty('$connect');
            expect(client).toHaveProperty('$disconnect');
        });

        it('should return the same instance on multiple calls (singleton)', () => {
            const client1 = getPrismaClient();
            const client2 = getPrismaClient();

            expect(client1).toBe(client2);
        });
    });

    describe('disconnectPrisma', () => {
        it('should disconnect the Prisma client', async () => {
            const client = getPrismaClient();
            const disconnectSpy = jest.spyOn(client, '$disconnect').mockResolvedValue();

            await disconnectPrisma();

            expect(disconnectSpy).toHaveBeenCalled();
            disconnectSpy.mockRestore();
        });
    });
});
